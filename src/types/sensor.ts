export type SensorKind =
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

export interface AlertChannel {
  id: string
  type: 'sms' | 'email' | 'push'
  target: string
  enabled: boolean
}

export interface Sensor {
  id: string
  name: string
  kind: SensorKind
  siteId: string
  unit: string
  currentValue: number
  status: SensorStatus
  lastReadingAt: string // ISO timestamp
  history: { t: string; v: number }[]
  thresholds: ThresholdRule[]
  alertChannels: AlertChannel[]
  notes?: string
}

export interface Site {
  id: string
  name: string
  location: string
  sensorCount: number
}

export const SENSOR_KIND_LABELS: Record<SensorKind, string> = {
  temperature: 'Température',
  pressure: 'Pression',
  flow: 'Débit',
  level: 'Niveau',
  humidity: 'Humidité',
  vacuum: 'Vide (dépression)',
}

export const SENSOR_KIND_UNITS: Record<SensorKind, string> = {
  temperature: '°C',
  pressure: 'kPa',
  flow: 'L/min',
  level: '%',
  humidity: '%',
  vacuum: 'inHg',
}
