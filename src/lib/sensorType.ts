import type { Sensor } from '../types/sensor'
import { CHANNEL_KIND_LABELS } from '../types/sensor'

/** Nom commercial du modèle. Pour les capteurs de vide, déduit du nombre
 * de ports (fabrication 1/2/3 ports). Pour les autres types découverts
 * côté API réelle, basé sur le deviceType brut. */
export function getSensorTypeLabel(sensor: Sensor): string {
  if (sensor.deviceType === 1) return 'Niveau de bassin'
  if (sensor.deviceType === 10) return 'Répéteur'

  const vacuumCount = sensor.channels.filter((c) => c.kind === 'vacuum').length

  if (vacuumCount === 1) return 'Vacuum simple'
  if (vacuumCount === 2) return 'Vacuum double'
  if (vacuumCount === 3) return 'Vacuum triple'
  if (vacuumCount > 3) return `Vacuum ${vacuumCount} ports`

  // Pas de canal de vide — capteur d'un autre type, fallback sur le premier canal.
  const firstKind = sensor.channels[0]?.kind
  return firstKind ? CHANNEL_KIND_LABELS[firstKind] : 'Capteur'
}
