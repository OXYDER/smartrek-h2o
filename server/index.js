import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || '/data'
const OVERLAY_PATH = path.join(DATA_DIR, 'overlay.json')
const HISTORY_PATH = path.join(DATA_DIR, 'history.json')
const STATIC_DIR = path.join(__dirname, '..', 'dist')

const HISTORY_MIN_INTERVAL_MS = 5 * 60 * 1000 // n'enregistre pas plus d'1 point/5min si la valeur n'a pas changé
const HISTORY_MAX_POINTS = 2000 // par canal — évite une croissance illimitée

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

function loadJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return fallback
  }
}

function saveJson(filePath, data) {
  ensureDataDir()
  fs.writeFileSync(filePath, JSON.stringify(data))
}

function loadOverlay() {
  return loadJson(OVERLAY_PATH, { sensors: {}, sites: {} })
}

function saveOverlay(overlay) {
  saveJson(OVERLAY_PATH, overlay)
}

function loadHistory() {
  return loadJson(HISTORY_PATH, {})
}

function saveHistory(history) {
  saveJson(HISTORY_PATH, history)
}

const app = express()
app.use(express.json())

app.get('/health', (req, res) => {
  res.type('text/plain').send('ok\n')
})

// ---- Config locale (seuils, différentiel, notes, renommages) ----
// Séparée de Smartrek : jamais renvoyée à leur API, jamais lue depuis
// leur boot — uniquement notre propre couche de config par-dessus leurs
// données en direct.

app.get('/api/overlay', (req, res) => {
  res.json(loadOverlay())
})

app.put('/api/overlay/sensor/:id', (req, res) => {
  const overlay = loadOverlay()
  const existing = overlay.sensors[req.params.id] || {}
  const patch = req.body || {}
  const mergedChannels = { ...(existing.channels || {}) }
  if (patch.channels) {
    for (const [chId, chPatch] of Object.entries(patch.channels)) {
      mergedChannels[chId] = { ...(mergedChannels[chId] || {}), ...chPatch }
    }
  }
  overlay.sensors[req.params.id] = { ...existing, ...patch, channels: mergedChannels }
  saveOverlay(overlay)
  res.json(overlay.sensors[req.params.id])
})

app.delete('/api/overlay/sensor/:id', (req, res) => {
  const overlay = loadOverlay()
  delete overlay.sensors[req.params.id]
  saveOverlay(overlay)
  res.json({ ok: true })
})

app.put('/api/overlay/site/:id', (req, res) => {
  const overlay = loadOverlay()
  overlay.sites[req.params.id] = { ...(overlay.sites[req.params.id] || {}), ...req.body }
  saveOverlay(overlay)
  res.json(overlay.sites[req.params.id])
})

// ---- Historique ----
// On accumule nous-mêmes à partir de maintenant, puisque Smartrek ne
// retourne aucun historique (endpoint Nodes/query toujours vide).

app.post('/api/history/batch', (req, res) => {
  const points = Array.isArray(req.body?.points) ? req.body.points : []
  const history = loadHistory()
  for (const { channelId, t, v } of points) {
    if (!channelId || typeof t !== 'number' || typeof v !== 'number') continue
    if (!history[channelId]) history[channelId] = []
    const arr = history[channelId]
    const last = arr[arr.length - 1]
    const shouldLog = !last || last.v !== v || t - last.t >= HISTORY_MIN_INTERVAL_MS
    if (shouldLog) {
      arr.push({ t, v })
      if (arr.length > HISTORY_MAX_POINTS) arr.shift()
    }
  }
  saveHistory(history)
  res.json({ ok: true })
})

app.get('/api/history/:channelId', (req, res) => {
  const history = loadHistory()
  const since = req.query.since ? Number(req.query.since) : null
  let points = history[req.params.channelId] || []
  if (since) points = points.filter((p) => p.t >= since)
  res.json(points)
})

// ---- Sert le frontend buildé ----
app.use(express.static(STATIC_DIR))
app.get('*', (req, res) => {
  res.sendFile(path.join(STATIC_DIR, 'index.html'))
})

const PORT = process.env.PORT || 80
app.listen(PORT, () => {
  console.log(`smartrek-h2o server sur le port ${PORT}, données dans ${DATA_DIR}`)
})
