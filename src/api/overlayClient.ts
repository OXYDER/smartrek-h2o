import type { PortDifferentialConfig, Sensor, Site, ThresholdRule } from '../types/sensor'
import { getUserId } from './auth'

/**
 * Client pour NOTRE serveur (server/index.js + PostgreSQL), pas Smartrek.
 * Stocke la config locale (seuils, différentiel, notes, renommages) et
 * l'historique — séparé de tout ce qui vient de Smartrek, jamais renvoyé
 * à leur API. Base multi-client : chaque requête porte l'en-tête
 * `X-Tenant-Id` (le `user._id` que Smartrek retourne à la connexion),
 * qui partitionne toutes les données par client Smartrek différent.
 */

function tenantHeaders(extra?: Record<string, string>): Record<string, string> {
  const userId = getUserId()
  return { ...(userId ? { 'X-Tenant-Id': userId } : {}), ...extra }
}

interface SensorOverlay {
  name?: string
  notes?: string
  channels?: Record<string, { thresholds?: ThresholdRule[]; differential?: PortDifferentialConfig | null }>
}

interface SiteOverlay {
  name?: string
  location?: string
}

export interface Overlay {
  sensors: Record<string, SensorOverlay>
  sites: Record<string, SiteOverlay>
}

export async function fetchOverlay(): Promise<Overlay> {
  try {
    const res = await fetch('/api/overlay', { headers: tenantHeaders() })
    if (!res.ok) return { sensors: {}, sites: {} }
    return await res.json()
  } catch {
    return { sensors: {}, sites: {} }
  }
}

export async function saveSensorOverlay(id: string, patch: SensorOverlay): Promise<void> {
  try {
    await fetch(`/api/overlay/sensor/${id}`, {
      method: 'PUT',
      headers: tenantHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(patch),
    })
  } catch {
    // best-effort — la config reste appliquée en mémoire même si la sauvegarde échoue
  }
}

export async function saveSiteOverlay(id: string, patch: SiteOverlay): Promise<void> {
  try {
    await fetch(`/api/overlay/site/${id}`, {
      method: 'PUT',
      headers: tenantHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(patch),
    })
  } catch {
    // best-effort
  }
}

/** Applique l'overlay local par-dessus les données fraîches de Smartrek. */
export function applyOverlay(sites: Site[], sensors: Sensor[], overlay: Overlay): { sites: Site[]; sensors: Sensor[] } {
  const mergedSites = sites.map((s) => {
    const o = overlay.sites[s.id]
    if (!o) return s
    return { ...s, ...(o.name !== undefined ? { name: o.name } : {}), ...(o.location !== undefined ? { location: o.location } : {}) }
  })

  const mergedSensors = sensors.map((sensor) => {
    const o = overlay.sensors[sensor.id]
    if (!o) return sensor
    const channels = sensor.channels.map((c) => {
      const co = o.channels?.[c.id]
      if (!co) return c
      return {
        ...c,
        thresholds: co.thresholds ?? c.thresholds,
        differential: 'differential' in co ? (co.differential ?? undefined) : c.differential,
      }
    })
    return {
      ...sensor,
      ...(o.name !== undefined ? { name: o.name } : {}),
      ...(o.notes !== undefined ? { notes: o.notes } : {}),
      channels,
    }
  })

  return { sites: mergedSites, sensors: mergedSensors }
}

/** Envoie les lectures actuelles vers l'historique — dédupliqué et throttlé
 * côté serveur, et sert aussi à détecter les fuites (voir alarm_events). */
export async function logHistory(sensors: Sensor[]): Promise<void> {
  const now = Date.now()
  const points = sensors.flatMap((sensor) =>
    sensor.channels.map((c) => ({ channelId: c.id, sensorId: sensor.id, t: now, v: c.currentValue }))
  )
  if (points.length === 0) return
  try {
    await fetch('/api/history/batch', {
      method: 'POST',
      headers: tenantHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ points }),
    })
  } catch {
    // best-effort
  }
}

export async function fetchChannelHistory(channelId: string): Promise<{ t: number; v: number }[]> {
  try {
    const res = await fetch(`/api/history/${channelId}`, { headers: tenantHeaders() })
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

// ---- Statistiques (fuites vacuum) ----

export interface LeakSummary {
  leak_count: number
  total_seconds: number
  ongoing_count: number
}

export interface LeakByHour {
  hour: number
  leak_count: number
  total_seconds: number
}

export interface LeakByLine {
  sensor_id: string
  leak_count: number
  total_seconds: number
  worst_peak: number
}

export interface LeakDayNight {
  period: 'jour' | 'nuit'
  leak_count: number
  total_seconds: number
}

export interface LeakTimelinePoint {
  t: number
  leakCount: number
}

async function fetchStats<T>(path: string, days: number, extraParams?: Record<string, string>): Promise<T | null> {
  try {
    const params = new URLSearchParams({ days: String(days), ...extraParams })
    const res = await fetch(`/api/stats/${path}?${params}`, { headers: tenantHeaders() })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export const statsClient = {
  summary: (days: number) => fetchStats<LeakSummary>('summary', days),
  byHourOfDay: (days: number) => fetchStats<LeakByHour[]>('by-hour-of-day', days),
  byLine: (days: number) => fetchStats<LeakByLine[]>('by-line', days),
  dayNight: (days: number) => fetchStats<LeakDayNight[]>('day-night', days),
  timeline: (days: number, bucket: 'minute' | 'hour' | 'day') =>
    fetchStats<LeakTimelinePoint[]>('timeline', days, { bucket }),
}
