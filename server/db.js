import pg from 'pg'

const { Pool } = pg

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

/**
 * Schéma multi-client — chaque table porte un `tenant_id`, dérivé du
 * `user._id` que Smartrek retourne à la connexion (voir src/api/auth.ts
 * côté frontend). Pas de système de comptes séparé à maintenir : Smartrek
 * authentifie déjà chaque client, on ne fait que partitionner NOS propres
 * données (config locale + historique) par cet identifiant.
 */
export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sensor_overlay (
      tenant_id TEXT NOT NULL,
      sensor_id TEXT NOT NULL,
      name TEXT,
      notes TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (tenant_id, sensor_id)
    );

    CREATE TABLE IF NOT EXISTS channel_overlay (
      tenant_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      sensor_id TEXT NOT NULL,
      thresholds JSONB NOT NULL DEFAULT '[]',
      differential JSONB,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (tenant_id, channel_id)
    );
    CREATE INDEX IF NOT EXISTS idx_channel_overlay_sensor ON channel_overlay (tenant_id, sensor_id);

    CREATE TABLE IF NOT EXISTS site_overlay (
      tenant_id TEXT NOT NULL,
      site_id TEXT NOT NULL,
      name TEXT,
      location TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (tenant_id, site_id)
    );

    -- Historique brut, fenêtre récente (voir rollupOldHistory ci-dessous)
    CREATE TABLE IF NOT EXISTS channel_history (
      tenant_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      t TIMESTAMPTZ NOT NULL,
      v DOUBLE PRECISION NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_channel_history_lookup ON channel_history (tenant_id, channel_id, t DESC);

    -- Agrégats horaires pour l'historique long terme, après rollup
    CREATE TABLE IF NOT EXISTS channel_history_hourly (
      tenant_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      hour TIMESTAMPTZ NOT NULL,
      avg_v DOUBLE PRECISION NOT NULL,
      min_v DOUBLE PRECISION NOT NULL,
      max_v DOUBLE PRECISION NOT NULL,
      sample_count INT NOT NULL,
      PRIMARY KEY (tenant_id, channel_id, hour)
    );

    -- Événements d'alarme (transitions vers/hors état d'alarme) — une ligne
    -- par épisode, pas par lecture. C'est ce qui permet de compter de
    -- vraies "fuites" (durée, pic, heure de début) plutôt que des points
    -- de lecture individuels.
    CREATE TABLE IF NOT EXISTS alarm_events (
      id BIGSERIAL PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      sensor_id TEXT NOT NULL,
      kind TEXT NOT NULL, -- 'threshold' | 'differential'
      started_at TIMESTAMPTZ NOT NULL,
      ended_at TIMESTAMPTZ,
      peak_value DOUBLE PRECISION
    );
    CREATE INDEX IF NOT EXISTS idx_alarm_events_lookup ON alarm_events (tenant_id, channel_id, started_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_alarm_events_open
      ON alarm_events (tenant_id, channel_id, kind) WHERE ended_at IS NULL;
  `)
}

// ---- Overlay (config locale) ----

export async function getOverlay(tenantId) {
  const [sensors, channels, sites] = await Promise.all([
    pool.query('SELECT sensor_id, name, notes FROM sensor_overlay WHERE tenant_id = $1', [tenantId]),
    pool.query('SELECT channel_id, sensor_id, thresholds, differential FROM channel_overlay WHERE tenant_id = $1', [
      tenantId,
    ]),
    pool.query('SELECT site_id, name, location FROM site_overlay WHERE tenant_id = $1', [tenantId]),
  ])

  const sensorMap = {}
  for (const s of sensors.rows) {
    sensorMap[s.sensor_id] = { name: s.name ?? undefined, notes: s.notes ?? undefined, channels: {} }
  }
  for (const c of channels.rows) {
    if (!sensorMap[c.sensor_id]) sensorMap[c.sensor_id] = { channels: {} }
    sensorMap[c.sensor_id].channels[c.channel_id] = {
      thresholds: c.thresholds,
      differential: c.differential ?? undefined,
    }
  }

  const siteMap = {}
  for (const s of sites.rows) {
    siteMap[s.site_id] = { name: s.name ?? undefined, location: s.location ?? undefined }
  }

  return { sensors: sensorMap, sites: siteMap }
}

export async function upsertSensorOverlay(tenantId, sensorId, patch) {
  if (patch.name !== undefined || patch.notes !== undefined) {
    await pool.query(
      `INSERT INTO sensor_overlay (tenant_id, sensor_id, name, notes, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (tenant_id, sensor_id) DO UPDATE SET
         name = COALESCE($3, sensor_overlay.name),
         notes = COALESCE($4, sensor_overlay.notes),
         updated_at = now()`,
      [tenantId, sensorId, patch.name ?? null, patch.notes ?? null]
    )
  }
  if (patch.channels) {
    for (const [channelId, chPatch] of Object.entries(patch.channels)) {
      await pool.query(
        `INSERT INTO channel_overlay (tenant_id, channel_id, sensor_id, thresholds, differential, updated_at)
         VALUES ($1, $2, $3, COALESCE($4, '[]'::jsonb), $5, now())
         ON CONFLICT (tenant_id, channel_id) DO UPDATE SET
           thresholds = COALESCE($4, channel_overlay.thresholds),
           differential = CASE WHEN $6 THEN $5 ELSE channel_overlay.differential END,
           updated_at = now()`,
        [
          tenantId,
          channelId,
          sensorId,
          chPatch.thresholds ? JSON.stringify(chPatch.thresholds) : null,
          chPatch.differential ? JSON.stringify(chPatch.differential) : null,
          'differential' in chPatch, // sait si on doit écraser (y compris avec null pour "retirer")
        ]
      )
    }
  }
}

export async function deleteSensorOverlay(tenantId, sensorId) {
  await pool.query('DELETE FROM sensor_overlay WHERE tenant_id = $1 AND sensor_id = $2', [tenantId, sensorId])
  await pool.query('DELETE FROM channel_overlay WHERE tenant_id = $1 AND sensor_id = $2', [tenantId, sensorId])
}

export async function upsertSiteOverlay(tenantId, siteId, patch) {
  await pool.query(
    `INSERT INTO site_overlay (tenant_id, site_id, name, location, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (tenant_id, site_id) DO UPDATE SET
       name = COALESCE($3, site_overlay.name),
       location = COALESCE($4, site_overlay.location),
       updated_at = now()`,
    [tenantId, siteId, patch.name ?? null, patch.location ?? null]
  )
}

// ---- Historique + détection de fuites ----

const HISTORY_MIN_INTERVAL_MS = 5 * 60 * 1000

function isAlarmingAgainstRule(value, rule) {
  if (!rule || !rule.enabled) return false
  if (rule.max !== undefined && value >= rule.max) return true
  if (rule.min !== undefined && value <= rule.min) return true
  return false
}

function isThresholdAlarming(value, thresholds) {
  return (thresholds || []).some((t) => isAlarmingAgainstRule(value, t))
}

/** Enregistre un lot de lectures — historique déduplique (comme avant),
 * plus détection d'alarme par seuil qui ouvre/ferme des `alarm_events`.
 * Optimisé pour peu d'aller-retours DB peu importe le nombre de canaux
 * dans le lot (quelques requêtes groupées, pas une par canal). */
export async function recordHistoryBatch(tenantId, points) {
  if (points.length === 0) return
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const channelIds = [...new Set(points.map((p) => p.channelId))]

    // Dernière valeur connue par canal — une seule requête groupée
    const { rows: lastRows } = await client.query(
      `SELECT DISTINCT ON (channel_id) channel_id, v, t
       FROM channel_history
       WHERE tenant_id = $1 AND channel_id = ANY($2)
       ORDER BY channel_id, t DESC`,
      [tenantId, channelIds]
    )
    const lastByChannel = new Map(lastRows.map((r) => [r.channel_id, { v: r.v, t: new Date(r.t).getTime() }]))

    const toInsert = points.filter((p) => {
      const last = lastByChannel.get(p.channelId)
      return !last || last.v !== p.v || p.t - last.t >= HISTORY_MIN_INTERVAL_MS
    })
    if (toInsert.length > 0) {
      const values = []
      const placeholders = toInsert
        .map((p, i) => {
          values.push(tenantId, p.channelId, new Date(p.t), p.v)
          const base = i * 4
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`
        })
        .join(',')
      await client.query(`INSERT INTO channel_history (tenant_id, channel_id, t, v) VALUES ${placeholders}`, values)
    }

    // Config des canaux (seuils) — une seule requête groupée
    const { rows: overlays } = await client.query(
      `SELECT channel_id, sensor_id, thresholds FROM channel_overlay WHERE tenant_id = $1 AND channel_id = ANY($2)`,
      [tenantId, channelIds]
    )
    const overlayByChannel = new Map(overlays.map((o) => [o.channel_id, o]))

    // Événements ouverts existants — une seule requête groupée
    const { rows: openEvents } = await client.query(
      `SELECT id, channel_id, peak_value FROM alarm_events
       WHERE tenant_id = $1 AND channel_id = ANY($2) AND kind = 'threshold' AND ended_at IS NULL`,
      [tenantId, channelIds]
    )
    const openByChannel = new Map(openEvents.map((e) => [e.channel_id, e]))

    for (const p of points) {
      const overlay = overlayByChannel.get(p.channelId)
      if (!overlay) continue
      const alarming = isThresholdAlarming(p.v, overlay.thresholds)
      const open = openByChannel.get(p.channelId)

      if (alarming && !open) {
        await client.query(
          `INSERT INTO alarm_events (tenant_id, channel_id, sensor_id, kind, started_at, peak_value)
           VALUES ($1, $2, $3, 'threshold', $4, $5)`,
          [tenantId, p.channelId, overlay.sensor_id, new Date(p.t), p.v]
        )
      } else if (!alarming && open) {
        await client.query(`UPDATE alarm_events SET ended_at = $1 WHERE id = $2`, [new Date(p.t), open.id])
      }
      // alarme déjà ouverte et toujours active : rien à faire (le pic n'est
      // pas recalculé à chaque point, suffisant pour ce niveau de détail)
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export async function getChannelHistory(tenantId, channelId, sinceMs) {
  const params = [tenantId, channelId]
  let where = 'tenant_id = $1 AND channel_id = $2'
  if (sinceMs) {
    params.push(new Date(sinceMs))
    where += ` AND t >= $${params.length}`
  }
  const { rows } = await pool.query(
    `SELECT t, v FROM channel_history WHERE ${where} ORDER BY t ASC LIMIT 5000`,
    params
  )
  return rows.map((r) => ({ t: new Date(r.t).getTime(), v: r.v }))
}

/** Condense l'historique brut de plus de 14 jours en agrégats horaires,
 * puis le supprime — évite une croissance illimitée de `channel_history`
 * à l'échelle de centaines de clients. Appelé périodiquement. */
export async function rollupOldHistory() {
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
  await pool.query(
    `INSERT INTO channel_history_hourly (tenant_id, channel_id, hour, avg_v, min_v, max_v, sample_count)
     SELECT tenant_id, channel_id, date_trunc('hour', t) AS hour,
            avg(v), min(v), max(v), count(*)
     FROM channel_history
     WHERE t < $1
     GROUP BY tenant_id, channel_id, date_trunc('hour', t)
     ON CONFLICT (tenant_id, channel_id, hour) DO UPDATE SET
       avg_v = EXCLUDED.avg_v, min_v = EXCLUDED.min_v, max_v = EXCLUDED.max_v, sample_count = EXCLUDED.sample_count`,
    [cutoff]
  )
  await pool.query('DELETE FROM channel_history WHERE t < $1', [cutoff])
}

// ---- Statistiques (fuites/écarts) ----

export async function getLeaksByHourOfDay(tenantId, sinceMs) {
  const { rows } = await pool.query(
    `SELECT EXTRACT(HOUR FROM started_at)::int AS hour,
            COUNT(*)::int AS leak_count,
            COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(ended_at, now()) - started_at))), 0)::float AS total_seconds
     FROM alarm_events
     WHERE tenant_id = $1 AND kind = 'threshold' AND started_at >= $2
     GROUP BY hour ORDER BY hour`,
    [tenantId, new Date(sinceMs)]
  )
  return rows
}

export async function getLeaksByLine(tenantId, sinceMs, limit = 15) {
  const { rows } = await pool.query(
    `SELECT sensor_id,
            COUNT(*)::int AS leak_count,
            COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(ended_at, now()) - started_at))), 0)::float AS total_seconds,
            MAX(peak_value) AS worst_peak
     FROM alarm_events
     WHERE tenant_id = $1 AND kind = 'threshold' AND started_at >= $2
     GROUP BY sensor_id ORDER BY leak_count DESC LIMIT $3`,
    [tenantId, new Date(sinceMs), limit]
  )
  return rows
}

export async function getLeaksDayNight(tenantId, sinceMs) {
  const { rows } = await pool.query(
    `SELECT
       CASE WHEN EXTRACT(HOUR FROM started_at) BETWEEN 6 AND 19 THEN 'jour' ELSE 'nuit' END AS period,
       COUNT(*)::int AS leak_count,
       COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(ended_at, now()) - started_at))), 0)::float AS total_seconds
     FROM alarm_events
     WHERE tenant_id = $1 AND kind = 'threshold' AND started_at >= $2
     GROUP BY period`,
    [tenantId, new Date(sinceMs)]
  )
  return rows
}

export async function getLeaksTimeline(tenantId, sinceMs, bucket) {
  const validBuckets = ['minute', 'hour', 'day']
  const b = validBuckets.includes(bucket) ? bucket : 'hour'
  const { rows } = await pool.query(
    `SELECT date_trunc('${b}', started_at) AS bucket, COUNT(*)::int AS leak_count
     FROM alarm_events
     WHERE tenant_id = $1 AND kind = 'threshold' AND started_at >= $2
     GROUP BY bucket ORDER BY bucket`,
    [tenantId, new Date(sinceMs)]
  )
  return rows.map((r) => ({ t: new Date(r.bucket).getTime(), leakCount: r.leak_count }))
}

export async function getLeaksSummary(tenantId, sinceMs) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS leak_count,
            COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(ended_at, now()) - started_at))), 0)::float AS total_seconds,
            COUNT(*) FILTER (WHERE ended_at IS NULL)::int AS ongoing_count
     FROM alarm_events
     WHERE tenant_id = $1 AND kind = 'threshold' AND started_at >= $2`,
    [tenantId, new Date(sinceMs)]
  )
  return rows[0]
}
