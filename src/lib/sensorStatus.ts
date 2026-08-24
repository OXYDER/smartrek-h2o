import type { Sensor, SensorStatus } from '../types/sensor'

/** Au-delà de ce délai sans nouvelle lecture, un capteur est considéré
 * hors ligne — peu importe ce qu'un champ "status" figé pourrait dire. */
export const STALE_AFTER_MS = 10 * 60 * 1000 // 10 minutes

export function isChannelAlarming(channel: Sensor['channels'][number]): boolean {
  return channel.thresholds.some(
    (t) =>
      t.enabled &&
      ((t.max !== undefined && channel.currentValue >= t.max) ||
        (t.min !== undefined && channel.currentValue <= t.min))
  )
}

export function getSensorStatus(sensor: Pick<Sensor, 'channels' | 'lastReadingAt'>): SensorStatus {
  if (sensor.channels.length === 0) return 'offline'
  const ageMs = Date.now() - new Date(sensor.lastReadingAt).getTime()
  if (ageMs > STALE_AFTER_MS) return 'offline'
  if (sensor.channels.some(isChannelAlarming)) return 'alarm'
  return 'online'
}
