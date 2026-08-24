export type ChannelKind =
  | 'temperature'
  | 'pressure'
  | 'flow'
  | 'level'
  | 'humidity'
  | 'vacuum'

export type SensorStatus = 'online' | 'offline' | 'warning' | 'alarm'

export interface ThresholdRule {
  id: string
  label: string
  min?: number
  max?: number
  enabled: boolean
}

/** Un canal de lecture individuel sur un nœud capteur (ex. un des 3 canaux
 * de vide + le canal de température d'un capteur physique Smartrek). */
export interface SensorChannel {
  id: string
  label: string
  kind: ChannelKind
  unit: string
  currentValue: number
  history: { t: string; v: number }[]
  thresholds: ThresholdRule[]
}

export interface NotificationChannel {
  id: string
  type: 'sms' | 'email' | 'push'
  target: string
  enabled: boolean
}

/** Un nœud capteur physique — peut exposer plusieurs canaux de lecture
 * (ex. 3 sondes de vide + 1 sonde de température sur le même boîtier). */
export interface Sensor {
  id: string
  name: string
  mac?: string
  serialNumber?: string
  siteId: string
  status: SensorStatus
  lastReadingAt: string // ISO timestamp
  channels: SensorChannel[]
  notificationChannels: NotificationChannel[]
  notes?: string
}

export interface Site {
  id: string
  name: string
  location: string
  sensorCount: number
}

export const CHANNEL_KIND_LABELS: Record<ChannelKind, string> = {
  temperature: 'Température',
  pressure: 'Pression',
  flow: 'Débit',
  level: 'Niveau',
  humidity: 'Humidité',
  vacuum: 'Vide',
}

export const CHANNEL_KIND_UNITS: Record<ChannelKind, string> = {
  temperature: '°C',
  pressure: 'kPa',
  flow: 'L/min',
  level: '%',
  humidity: '%',
  vacuum: 'inHg',
}

export const CHANNEL_KIND_ABBR: Record<ChannelKind, string> = {
  temperature: 'T',
  pressure: 'P',
  flow: 'D',
  level: 'N',
  humidity: 'H',
  vacuum: 'V',
}
