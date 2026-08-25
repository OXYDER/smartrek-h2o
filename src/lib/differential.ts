import type { Sensor } from '../types/sensor'

/** Moyenne des canaux de vide actifs d'un capteur — sert de valeur unique
 * pour comparer un capteur multi-ports à un autre. */
export function getVacuumAverage(sensor: Sensor): number | undefined {
  const vac = sensor.channels.filter((c) => c.kind === 'vacuum')
  if (vac.length === 0) return undefined
  const sum = vac.reduce((total, c) => total + c.currentValue, 0)
  return Math.round((sum / vac.length) * 100) / 100
}

/** Différence (signée) entre ce capteur et son capteur de référence, en inHg.
 * Positif = ce capteur lit plus haut que la référence ; négatif = plus bas
 * (ex. perte de vide en aval d'une fuite). */
export function getDifferential(sensor: Sensor, allSensors: Sensor[]): number | undefined {
  if (!sensor.referenceSensorId) return undefined
  const reference = allSensors.find((s) => s.id === sensor.referenceSensorId)
  if (!reference) return undefined
  const own = getVacuumAverage(sensor)
  const refAvg = getVacuumAverage(reference)
  if (own === undefined || refAvg === undefined) return undefined
  return Math.round((own - refAvg) * 100) / 100
}

export function isDifferentialAlarming(sensor: Sensor, allSensors: Sensor[]): boolean {
  const t = sensor.differentialThreshold
  if (!t || !t.enabled) return false
  const diff = getDifferential(sensor, allSensors)
  if (diff === undefined) return false
  if (t.max !== undefined && diff >= t.max) return true
  if (t.min !== undefined && diff <= t.min) return true
  return false
}
