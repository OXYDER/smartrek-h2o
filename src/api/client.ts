import type { Sensor, Site, ThresholdRule, AlertChannel } from '../types/sensor'
import { mockSensors, mockSites } from './mockData'

/**
 * Couche d'accès aux données — actuellement en mémoire (mock).
 *
 * POUR BRANCHER LA VRAIE API SMARTREK H2O :
 * 1. Capture les requêtes réelles via DevTools (Network > Fetch/XHR) pendant
 *    que tu navigues sur app3.smartrekh2o.com.
 * 2. Remplace le contenu de chaque méthode ci-dessous par un vrai `fetch()`
 *    vers l'endpoint capturé (garde la même signature de fonction pour ne
 *    rien casser dans les composants).
 * 3. Si Smartrek H2O bloque le CORS depuis le navigateur, ajoute un petit
 *    proxy (ex: route Express/Vercel) qui relaie les requêtes côté serveur
 *    avec le cookie/token d'auth stocké en variable d'environnement.
 */

const LATENCY_MS = 250

let sensors: Sensor[] = JSON.parse(JSON.stringify(mockSensors))
const sites: Site[] = JSON.parse(JSON.stringify(mockSites))

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), LATENCY_MS))
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

export const smartrekClient = {
  async listSites(): Promise<Site[]> {
    // TODO(réel): GET /api/sites
    return delay(sites)
  },

  async listSensors(siteId?: string): Promise<Sensor[]> {
    // TODO(réel): GET /api/sensors?siteId=...
    const result = siteId ? sensors.filter((s) => s.siteId === siteId) : sensors
    return delay(result)
  },

  async getSensor(id: string): Promise<Sensor | undefined> {
    // TODO(réel): GET /api/sensors/:id
    return delay(sensors.find((s) => s.id === id))
  },

  async createSensor(input: Omit<Sensor, 'id' | 'history' | 'lastReadingAt'>): Promise<Sensor> {
    // TODO(réel): POST /api/sensors
    const sensor: Sensor = {
      ...input,
      id: uid('sn'),
      history: [],
      lastReadingAt: new Date().toISOString(),
    }
    sensors = [...sensors, sensor]
    return delay(sensor)
  },

  async updateSensor(id: string, patch: Partial<Sensor>): Promise<Sensor | undefined> {
    // TODO(réel): PATCH /api/sensors/:id
    sensors = sensors.map((s) => (s.id === id ? { ...s, ...patch } : s))
    return delay(sensors.find((s) => s.id === id))
  },

  async deleteSensor(id: string): Promise<void> {
    // TODO(réel): DELETE /api/sensors/:id
    sensors = sensors.filter((s) => s.id !== id)
    return delay(undefined)
  },

  async upsertThreshold(sensorId: string, rule: ThresholdRule): Promise<Sensor | undefined> {
    // TODO(réel): PUT /api/sensors/:id/thresholds/:ruleId
    sensors = sensors.map((s) => {
      if (s.id !== sensorId) return s
      const exists = s.thresholds.some((t) => t.id === rule.id)
      const thresholds = exists
        ? s.thresholds.map((t) => (t.id === rule.id ? rule : t))
        : [...s.thresholds, { ...rule, id: rule.id || uid('th') }]
      return { ...s, thresholds }
    })
    return delay(sensors.find((s) => s.id === sensorId))
  },

  async deleteThreshold(sensorId: string, ruleId: string): Promise<Sensor | undefined> {
    // TODO(réel): DELETE /api/sensors/:id/thresholds/:ruleId
    sensors = sensors.map((s) =>
      s.id === sensorId ? { ...s, thresholds: s.thresholds.filter((t) => t.id !== ruleId) } : s
    )
    return delay(sensors.find((s) => s.id === sensorId))
  },

  async upsertAlertChannel(sensorId: string, channel: AlertChannel): Promise<Sensor | undefined> {
    // TODO(réel): PUT /api/sensors/:id/alerts/:channelId
    sensors = sensors.map((s) => {
      if (s.id !== sensorId) return s
      const exists = s.alertChannels.some((c) => c.id === channel.id)
      const alertChannels = exists
        ? s.alertChannels.map((c) => (c.id === channel.id ? channel : c))
        : [...s.alertChannels, { ...channel, id: channel.id || uid('al') }]
      return { ...s, alertChannels }
    })
    return delay(sensors.find((s) => s.id === sensorId))
  },

  async deleteAlertChannel(sensorId: string, channelId: string): Promise<Sensor | undefined> {
    // TODO(réel): DELETE /api/sensors/:id/alerts/:channelId
    sensors = sensors.map((s) =>
      s.id === sensorId
        ? { ...s, alertChannels: s.alertChannels.filter((c) => c.id !== channelId) }
        : s
    )
    return delay(sensors.find((s) => s.id === sensorId))
  },
}
