import type { Sensor } from '../types/sensor'

export interface SensorCategory {
  id: string
  label: string
}

export const SENSOR_CATEGORIES: SensorCategory[] = [
  { id: 'vacuum', label: 'Vacuum' },
  { id: 'level', label: "Niveau d'eau" },
  { id: 'flow', label: 'Débitmètre' },
  { id: 'remote', label: 'Contrôle à distance' },
  { id: 'tensiometer', label: 'Tensiomètre' },
]

export function sensorMatchesCategory(sensor: Sensor, categoryId: string): boolean {
  switch (categoryId) {
    case 'vacuum':
      return sensor.channels.some((c) => c.kind === 'vacuum')
    case 'level':
      return sensor.channels.some((c) => c.kind === 'level')
    case 'flow':
      return sensor.channels.some((c) => c.kind === 'flow')
    case 'tensiometer':
      return sensor.channels.some((c) => c.kind === 'tensiometer')
    case 'remote':
      // Pas encore de capteurs de ce type dans les vraies données capturées
      // — catégorie prévue pour plus tard (relais/actionneurs à distance).
      return false
    default:
      return false
  }
}
