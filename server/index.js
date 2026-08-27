import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  migrate,
  getOverlay,
  upsertSensorOverlay,
  deleteSensorOverlay,
  upsertSiteOverlay,
  recordHistoryBatch,
  getChannelHistory,
  rollupOldHistory,
  getLeaksByHourOfDay,
  getLeaksByLine,
  getLeaksDayNight,
  getLeaksTimeline,
  getLeaksSummary,
} from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STATIC_DIR = path.join(__dirname, '..', 'dist')

const app = express()
app.use(express.json())

app.get('/health', (req, res) => {
  res.type('text/plain').send('ok\n')
})

// Chaque client Smartrek différent = un tenant_id différent (le user._id
// que Smartrek retourne à leur connexion — voir src/api/auth.ts). Toutes
// les routes qui suivent exigent cet en-tête pour isoler les données.
function requireTenant(req, res, next) {
  const tenantId = req.header('X-Tenant-Id')
  if (!tenantId) return res.status(400).json({ error: 'En-tête X-Tenant-Id manquant.' })
  req.tenantId = tenantId
  next()
}

// ---- Config locale ----

app.get('/api/overlay', requireTenant, async (req, res) => {
  try {
    res.json(await getOverlay(req.tenantId))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erreur de lecture de la config locale.' })
  }
})

app.put('/api/overlay/sensor/:id', requireTenant, async (req, res) => {
  try {
    await upsertSensorOverlay(req.tenantId, req.params.id, req.body || {})
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erreur de sauvegarde.' })
  }
})

app.delete('/api/overlay/sensor/:id', requireTenant, async (req, res) => {
  try {
    await deleteSensorOverlay(req.tenantId, req.params.id)
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erreur de suppression.' })
  }
})

app.put('/api/overlay/site/:id', requireTenant, async (req, res) => {
  try {
    await upsertSiteOverlay(req.tenantId, req.params.id, req.body || {})
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erreur de sauvegarde.' })
  }
})

// ---- Historique ----

app.post('/api/history/batch', requireTenant, async (req, res) => {
  try {
    const points = Array.isArray(req.body?.points) ? req.body.points : []
    await recordHistoryBatch(req.tenantId, points)
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Erreur d'enregistrement de l'historique." })
  }
})

app.get('/api/history/:channelId', requireTenant, async (req, res) => {
  try {
    const since = req.query.since ? Number(req.query.since) : undefined
    res.json(await getChannelHistory(req.tenantId, req.params.channelId, since))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Erreur de lecture de l'historique." })
  }
})

// ---- Statistiques (fuites/écarts vacuum) ----
// `days` en query param (défaut 7). Toutes ces routes s'appuient sur les
// `alarm_events` détectés automatiquement à chaque lot d'historique reçu.

function sinceMsFromQuery(req, defaultDays = 7) {
  const days = req.query.days ? Number(req.query.days) : defaultDays
  return Date.now() - days * 24 * 60 * 60 * 1000
}

app.get('/api/stats/summary', requireTenant, async (req, res) => {
  try {
    res.json(await getLeaksSummary(req.tenantId, sinceMsFromQuery(req)))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erreur de calcul des statistiques.' })
  }
})

app.get('/api/stats/by-hour-of-day', requireTenant, async (req, res) => {
  try {
    res.json(await getLeaksByHourOfDay(req.tenantId, sinceMsFromQuery(req)))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erreur de calcul des statistiques.' })
  }
})

app.get('/api/stats/by-line', requireTenant, async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 15
    res.json(await getLeaksByLine(req.tenantId, sinceMsFromQuery(req), limit))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erreur de calcul des statistiques.' })
  }
})

app.get('/api/stats/day-night', requireTenant, async (req, res) => {
  try {
    res.json(await getLeaksDayNight(req.tenantId, sinceMsFromQuery(req)))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erreur de calcul des statistiques.' })
  }
})

app.get('/api/stats/timeline', requireTenant, async (req, res) => {
  try {
    const bucket = req.query.bucket || 'hour'
    res.json(await getLeaksTimeline(req.tenantId, sinceMsFromQuery(req), bucket))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erreur de calcul des statistiques.' })
  }
})

// ---- Sert le frontend buildé ----
app.use(express.static(STATIC_DIR))
app.get('*', (req, res) => {
  res.sendFile(path.join(STATIC_DIR, 'index.html'))
})

const PORT = process.env.PORT || 80

async function start() {
  await migrate()
  console.log('Schéma PostgreSQL prêt.')

  rollupOldHistory().catch((err) => console.error('Erreur rollup initial:', err))
  setInterval(() => {
    rollupOldHistory().catch((err) => console.error('Erreur rollup:', err))
  }, 60 * 60 * 1000)

  app.listen(PORT, () => {
    console.log(`smartrek-h2o server sur le port ${PORT}`)
  })
}

start().catch((err) => {
  console.error('Échec du démarrage du serveur (connexion PostgreSQL ?) :', err)
  process.exit(1)
})
