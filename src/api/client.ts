import type {
  Sensor,
  Site,
  ThresholdRule,
  NotificationChannel,
  SensorChannel,
  ChannelKind,
} from '../types/sensor'
import { fetchBoot } from './realBoot'

/**
 * Couche d'accès aux données — branchée sur le vrai /boot de Smartrek H2O.
 * Les lectures (sites/capteurs) viennent du serveur ; les écritures
 * (CRUD seuils/canaux/notifications/renommage) restent en mémoire locale
 * pour l'instant car les endpoints d'écriture réels n'ont pas encore été
 * capturés — voir docs/api-notes.md, section « À capturer encore ».
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
    const result = await fetchBoot()
    sites = result.sites
    sensors = result.sensors
    bootLoaded = true
    bootError = null
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
    // TODO(réel): endpoint de renommage de la passerelle — pas encore capturé, modif locale seulement
    const idx = sites.findIndex((s) => s.id === id)
    if (idx === -1) return delay(undefined)
    sites[idx] = { ...sites[idx], ...patch }
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
    // TODO(réel): endpoint de création de capteur — pas encore capturé
    const sensor: Sensor = {
      id: uid('sn'),
      name: input.name,
      siteId: input.siteId,
      status: 'offline',
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
      notificationChannels: [],
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

  async addChannel(
    sensorId: string,
    channel: { label: string; kind: ChannelKind; unit: string }
  ): Promise<Sensor | undefined> {
    // TODO(réel): endpoint d'ajout de canal — pas encore capturé
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
    // TODO(réel): PATCH /api/sensors/:id/channels/:channelId
    sensors = sensors.map((s) => {
      if (s.id !== sensorId) return s
      return { ...s, channels: s.channels.map((c) => (c.id === channelId ? { ...c, ...patch } : c)) }
    })
    return delay(sensors.find((s) => s.id === sensorId))
  },

  async deleteChannel(sensorId: string, channelId: string): Promise<Sensor | undefined> {
    // TODO(réel): DELETE /api/sensors/:id/channels/:channelId
    sensors = sensors.map((s) =>
      s.id === sensorId ? { ...s, channels: s.channels.filter((c) => c.id !== channelId) } : s
    )
    return delay(sensors.find((s) => s.id === sensorId))
  },

  async upsertThreshold(
    sensorId: string,
    channelId: string,
    rule: ThresholdRule
  ): Promise<Sensor | undefined> {
    // TODO(réel): PUT /api/sensors/:id/channels/:channelId/thresholds/:ruleId
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
          return { ...c, thresholds }
        }),
      }
    })
    return delay(sensors.find((s) => s.id === sensorId))
  },

  async deleteThreshold(
    sensorId: string,
    channelId: string,
    ruleId: string
  ): Promise<Sensor | undefined> {
    // TODO(réel): DELETE /api/sensors/:id/channels/:channelId/thresholds/:ruleId
    sensors = sensors.map((s) => {
      if (s.id !== sensorId) return s
      return {
        ...s,
        channels: s.channels.map((c) =>
          c.id === channelId ? { ...c, thresholds: c.thresholds.filter((t) => t.id !== ruleId) } : c
        ),
      }
    })
    return delay(sensors.find((s) => s.id === sensorId))
  },

  async upsertNotificationChannel(
    sensorId: string,
    channel: NotificationChannel
  ): Promise<Sensor | undefined> {
    // TODO(réel): PUT /api/sensors/:id/notifications/:channelId
    sensors = sensors.map((s) => {
      if (s.id !== sensorId) return s
      const exists = s.notificationChannels.some((c) => c.id === channel.id)
      const notificationChannels = exists
        ? s.notificationChannels.map((c) => (c.id === channel.id ? channel : c))
        : [...s.notificationChannels, { ...channel, id: channel.id || uid('al') }]
      return { ...s, notificationChannels }
    })
    return delay(sensors.find((s) => s.id === sensorId))
  },

  async deleteNotificationChannel(sensorId: string, channelId: string): Promise<Sensor | undefined> {
    // TODO(réel): DELETE /api/sensors/:id/notifications/:channelId
    sensors = sensors.map((s) =>
      s.id === sensorId
        ? { ...s, notificationChannels: s.notificationChannels.filter((c) => c.id !== channelId) }
        : s
    )
    return delay(sensors.find((s) => s.id === sensorId))
  },
}

export { findChannel }
