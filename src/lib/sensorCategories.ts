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

export const VACUUM_SUBCATEGORIES: { id: string; label: string; portCount: number }[] = [
  { id: 'vacuum:simple', label: 'Simple', portCount: 1 },
  { id: 'vacuum:double', label: 'Double', portCount: 2 },
  { id: 'vacuum:triple', label: 'Triple', portCount: 3 },
]

function vacuumPortCount(sensor: Sensor): number {
  return sensor.channels.filter((c) => c.kind === 'vacuum').length
}

export function sensorMatchesCategory(sensor: Sensor, categoryId: string): boolean {
  if (categoryId.startsWith('vacuum:')) {
    const variant = categoryId.split(':')[1]
    const count = vacuumPortCount(sensor)
    if (variant === 'simple') return count === 1
    if (variant === 'double') return count === 2
    if (variant === 'triple') return count === 3
    return false
  }

  switch (categoryId) {
    case 'vacuum':
      return sensor.deviceType === 0 || sensor.channels.some((c) => c.kind === 'vacuum')
    case 'level':
      return sensor.deviceType === 1 || sensor.channels.some((c) => c.kind === 'level')
    case 'flow':
      return sensor.channels.some((c) => c.kind === 'flow')
    case 'tensiometer':
      return sensor.channels.some((c) => c.kind === 'tensiometer')
    case 'remote':
      // type 2 = "A-Link Valve" — vraie unité de contrôle à distance (2
      // canaux relais). Les répéteurs (type 10) sont de l'infrastructure
      // réseau, pas des capteurs — ils ne rentrent dans aucune catégorie.
      return sensor.deviceType === 2
    default:
      return false
  }
}
