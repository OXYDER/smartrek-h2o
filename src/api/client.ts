import type { Sensor, Site, ThresholdRule, SensorChannel, ChannelKind, PortDifferentialConfig } from '../types/sensor'
import { fetchBoot } from './realBoot'
import { fetchOverlay, saveSensorOverlay, saveSiteOverlay, applyOverlay, logHistory } from './overlayClient'

/**
 * Couche d'accès aux données — lectures branchées sur le vrai /boot de
 * Smartrek H2O, écritures locales (seuils/différentiel/notes/renommages)
 * persistées sur NOTRE propre serveur (server/index.js), jamais renvoyées
 * à Smartrek. Les deux systèmes restent complètement séparés : à chaque
 * rafraîchissement, on prend les lectures fraîches de Smartrek et on
 * applique notre config locale par-dessus.
 */

const LATENCY_MS = 150

let sites: Site[] = []
let sensors: Sensor[] = []
let bootLoaded = false
let bootError: string | null = null

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), LATENCY_MS))
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

async function ensureBootLoaded(): Promise<void> {
  if (bootLoaded) return
  await refreshBoot()
}

async function refreshBoot(): Promise<void> {
  try {
    const [result, overlay] = await Promise.all([fetchBoot(), fetchOverlay()])
    const merged = applyOverlay(result.sites, result.sensors, overlay)
    sites = merged.sites
    sensors = merged.sensors
    bootLoaded = true
    bootError = null
    logHistory(sensors) // best-effort, ne bloque pas le chargement
  } catch (err) {
    bootError = err instanceof Error ? err.message : 'Erreur inconnue lors du chargement des données.'
    bootLoaded = true // évite de re-fetch en boucle ; refreshBoot() manuel pour réessayer
  }
}

function findChannel(sensor: Sensor, channelId: string): SensorChannel | undefined {
  return sensor.channels.find((c) => c.id === channelId)
}

export const smartrekClient = {
  async listSites(): Promise<Site[]> {
    await ensureBootLoaded()
    return delay(sites)
  },

  async updateSite(id: string, patch: Partial<Site>): Promise<Site | undefined> {
    const idx = sites.findIndex((s) => s.id === id)
    if (idx === -1) return delay(undefined)
    sites[idx] = { ...sites[idx], ...patch }
    saveSiteOverlay(id, patch) // best-effort, persisté sur notre serveur, jamais chez Smartrek
    return delay(sites[idx])
  },

  async listSensors(siteId?: string): Promise<Sensor[]> {
    await ensureBootLoaded()
    const result = siteId ? sensors.filter((s) => s.siteId === siteId) : sensors
    return delay(result)
  },

  async refreshBoot(): Promise<void> {
    await refreshBoot()
  },

  getBootError(): string | null {
    return bootError
  },

  async createSensor(input: {
    name: string
    siteId: string
    channels: { label: string; kind: ChannelKind; unit: string }[]
  }): Promise<Sensor> {
    // Capteur purement local (pas de correspondance Smartrek) — non persisté sur notre serveur pour l'instant.
    const sensor: Sensor = {
      id: uid('sn'),
      name: input.name,
      siteId: input.siteId,
      lastReadingAt: new Date().toISOString(),
      channels: input.channels.map((c) => ({
        id: uid('ch'),
        label: c.label,
        kind: c.kind,
        unit: c.unit,
        currentValue: 0,
        history: [],
        thresholds: [],
      })),
    }
    sensors = [...sensors, sensor]
    return delay(sensor)
  },

  async updateSensor(id: string, patch: Partial<Sensor>): Promise<Sensor | undefined> {
    sensors = sensors.map((s) => (s.id === id ? { ...s, ...patch } : s))

    // Persiste sur notre serveur : nom, notes, et/ou tableau de canaux
    // complet (converti en overlay par canal — seuils + différentiel).
    const overlayPatch: {
      name?: string
      notes?: string
      channels?: Record<string, { thresholds?: ThresholdRule[]; differential?: PortDifferentialConfig | null }>
    } = {}
    if (patch.name !== undefined) overlayPatch.name = patch.name
    if (patch.notes !== undefined) overlayPatch.notes = patch.notes
    if (patch.channels) {
      overlayPatch.channels = {}
      for (const c of patch.channels) {
        overlayPatch.channels[c.id] = { thresholds: c.thresholds, differential: c.differential ?? null }
      }
    }
    if (Object.keys(overlayPatch).length > 0) saveSensorOverlay(id, overlayPatch)

    return delay(sensors.find((s) => s.id === id))
  },

  async deleteSensor(id: string): Promise<void> {
    sensors = sensors.filter((s) => s.id !== id)
    return delay(undefined)
  },

  async addChannel(
    sensorId: string,
    channel: { label: string; kind: ChannelKind; unit: string }
  ): Promise<Sensor | undefined> {
    sensors = sensors.map((s) => {
      if (s.id !== sensorId) return s
      const newChannel: SensorChannel = {
        id: uid('ch'),
        label: channel.label,
        kind: channel.kind,
        unit: channel.unit,
        currentValue: 0,
        history: [],
        thresholds: [],
      }
      return { ...s, channels: [...s.channels, newChannel] }
    })
    return delay(sensors.find((s) => s.id === sensorId))
  },

  async updateChannel(
    sensorId: string,
    channelId: string,
    patch: Partial<Pick<SensorChannel, 'label' | 'kind' | 'unit'>>
  ): Promise<Sensor | undefined> {
    sensors = sensors.map((s) => {
      if (s.id !== sensorId) return s
      return { ...s, channels: s.channels.map((c) => (c.id === channelId ? { ...c, ...patch } : c)) }
    })
    return delay(sensors.find((s) => s.id === sensorId))
  },

  async deleteChannel(sensorId: string, channelId: string): Promise<Sensor | undefined> {
    sensors = sensors.map((s) =>
      s.id === sensorId ? { ...s, channels: s.channels.filter((c) => c.id !== channelId) } : s
    )
    return delay(sensors.find((s) => s.id === sensorId))
  },

  async upsertThreshold(sensorId: string, channelId: string, rule: ThresholdRule): Promise<Sensor | undefined> {
    let updatedThresholds: ThresholdRule[] = []
    sensors = sensors.map((s) => {
      if (s.id !== sensorId) return s
      return {
        ...s,
        channels: s.channels.map((c) => {
          if (c.id !== channelId) return c
          const exists = c.thresholds.some((t) => t.id === rule.id)
          const thresholds = exists
            ? c.thresholds.map((t) => (t.id === rule.id ? rule : t))
            : [...c.thresholds, { ...rule, id: rule.id || uid('th') }]
          updatedThresholds = thresholds
          return { ...c, thresholds }
        }),
      }
    })
    saveSensorOverlay(sensorId, { channels: { [channelId]: { thresholds: updatedThresholds } } })
    return delay(sensors.find((s) => s.id === sensorId))
  },

  async deleteThreshold(sensorId: string, channelId: string, ruleId: string): Promise<Sensor | undefined> {
    let updatedThresholds: ThresholdRule[] = []
    sensors = sensors.map((s) => {
      if (s.id !== sensorId) return s
      return {
        ...s,
        channels: s.channels.map((c) => {
          if (c.id !== channelId) return c
          updatedThresholds = c.thresholds.filter((t) => t.id !== ruleId)
          return { ...c, thresholds: updatedThresholds }
        }),
      }
    })
    saveSensorOverlay(sensorId, { channels: { [channelId]: { thresholds: updatedThresholds } } })
    return delay(sensors.find((s) => s.id === sensorId))
  },
}

export { findChannel }
