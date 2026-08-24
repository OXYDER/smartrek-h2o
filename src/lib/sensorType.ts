import type { Sensor } from '../types/sensor'
import { CHANNEL_KIND_LABELS } from '../types/sensor'

/** Nom commercial du modèle, déduit du nombre de ports de vide.
 * Les capteurs de vide existent en 3 modèles de fabrique : 1, 2 ou 3 ports. */
export function getSensorTypeLabel(sensor: Sensor): string {
  const vacuumCount = sensor.channels.filter((c) => c.kind === 'vacuum').length

  if (vacuumCount === 1) return 'Vacuum simple'
  if (vacuumCount === 2) return 'Vacuum double'
  if (vacuumCount === 3) return 'Vacuum triple'
  if (vacuumCount > 3) return `Vacuum ${vacuumCount} ports`

  // Pas de canal de vide — capteur d'un autre type, fallback sur le premier canal.
  const firstKind = sensor.channels[0]?.kind
  return firstKind ? CHANNEL_KIND_LABELS[firstKind] : 'Capteur'
}
