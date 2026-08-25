import type { Sensor, SensorStatus } from '../types/sensor'
import { isDifferentialAlarming } from './differential'

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
  const ageMs = Date.now() - new Date(sensor.lastReadingAt).getTime()
  if (ageMs > STALE_AFTER_MS) return 'offline'
  if (sensor.channels.some(isChannelAlarming)) return 'alarm'
  return 'online'
}

/** Un site (passerelle) est "en ligne" si au moins un de ses capteurs a
 * transmis récemment. Pas de statut propre côté API pour la passerelle
 * elle-même — c'est une approximation raisonnable basée sur ses capteurs. */
export function getSiteStatus(siteId: string, sensors: Sensor[]): 'online' | 'offline' {
  const now = Date.now()
  const hasFreshSensor = sensors.some(
    (s) => s.siteId === siteId && now - new Date(s.lastReadingAt).getTime() <= STALE_AFTER_MS
  )
  return hasFreshSensor ? 'online' : 'offline'
}

/** Comme getSensorStatus, mais inclut aussi l'alarme de différentiel de
 * vide (nécessite la liste complète des capteurs pour retrouver la
 * référence). Un capteur hors ligne reste hors ligne — pas la peine de
 * signaler une alarme sur une donnée déjà périmée. */
export function getEffectiveStatus(sensor: Sensor, allSensors: Sensor[]): SensorStatus {
  const base = getSensorStatus(sensor)
  if (base === 'offline') return base
  if (isDifferentialAlarming(sensor, allSensors)) return 'alarm'
  return base
}
