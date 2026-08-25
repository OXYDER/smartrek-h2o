import type { Sensor, SensorChannel } from '../types/sensor'

function portNumber(channel: SensorChannel): string | null {
  const m = channel.label.match(/\d+/)
  return m ? m[0] : null
}

/** Écart (signé, en inHg) entre CE port précis et le port de même numéro
 * sur le capteur de référence. Positif = ce port lit plus haut que la
 * référence ; négatif = plus bas (ex. perte de vide en aval d'une fuite). */
export function getPortDifferential(
  sensor: Sensor,
  channel: SensorChannel,
  allSensors: Sensor[]
): number | undefined {
  if (!sensor.referenceSensorId) return undefined
  const reference = allSensors.find((s) => s.id === sensor.referenceSensorId)
  if (!reference) return undefined
  const num = portNumber(channel)
  if (num === null) return undefined
  const refChannel = reference.channels.find((c) => c.kind === 'vacuum' && portNumber(c) === num)
  if (!refChannel) return undefined
  return Math.round((channel.currentValue - refChannel.currentValue) * 100) / 100
}

/** Alarme si l'écart d'AU MOINS UN port dépasse le seuil configuré. */
export function isDifferentialAlarming(sensor: Sensor, allSensors: Sensor[]): boolean {
  const t = sensor.differentialThreshold
  if (!t || !t.enabled) return false
  return sensor.channels
    .filter((c) => c.kind === 'vacuum')
    .some((c) => {
      const diff = getPortDifferential(sensor, c, allSensors)
      if (diff === undefined) return false
      if (t.max !== undefined && diff >= t.max) return true
      if (t.min !== undefined && diff <= t.min) return true
      return false
    })
}
