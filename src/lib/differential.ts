import type { Sensor, SensorChannel, PortDifferentialConfig } from '../types/sensor'

/** Construit le nouveau tableau `channels` avec le différentiel d'UN
 * canal mis à jour — utilisé avant un `smartrekClient.updateSensor()`
 * (pas d'endpoint dédié par canal, on patche le tableau en entier). */
export function withUpdatedDifferential(
  sensor: Sensor,
  channelId: string,
  config: PortDifferentialConfig | undefined
): SensorChannel[] {
  return sensor.channels.map((c) => (c.id === channelId ? { ...c, differential: config } : c))
}

/** Écart (signé, en inHg) entre CE port et le port de référence choisi
 * spécifiquement pour lui — capteur ET port de référence sont libres,
 * pas obligés d'être le même numéro de port. */
export function getChannelDifferential(channel: SensorChannel, allSensors: Sensor[]): number | undefined {
  if (!channel.differential) return undefined
  const refSensor = allSensors.find((s) => s.id === channel.differential!.referenceSensorId)
  if (!refSensor) return undefined
  const refChannel = refSensor.channels.find((c) => c.id === channel.differential!.referencePortId)
  if (!refChannel) return undefined
  return Math.round((channel.currentValue - refChannel.currentValue) * 100) / 100
}

export function isChannelDifferentialAlarming(channel: SensorChannel, allSensors: Sensor[]): boolean {
  const t = channel.differential?.threshold
  if (!t || !t.enabled) return false
  const diff = getChannelDifferential(channel, allSensors)
  if (diff === undefined) return false
  if (t.max !== undefined && diff >= t.max) return true
  if (t.min !== undefined && diff <= t.min) return true
  return false
}

/** Alarme si le différentiel d'AU MOINS UN port du capteur dépasse son seuil. */
export function isDifferentialAlarming(sensor: Sensor, allSensors: Sensor[]): boolean {
  return sensor.channels.some((c) => isChannelDifferentialAlarming(c, allSensors))
}
