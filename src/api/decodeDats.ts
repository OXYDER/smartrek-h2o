/**
 * Décodage du champ binaire `dats` (base64) retourné par l'API Smartrek H2O
 * sur /api/v2/boot. Formule reverse-engineered et validée en comparant le
 * payload décodé aux valeurs affichées dans l'app d'origine, pour 4
 * capteurs réels (voir docs/api-notes.md pour le détail de la validation).
 *
 * Structure (payload complet, 32-34 octets selon le nombre de canaux) :
 *   octets 0-7   : timestamp Unix en millisecondes (uint64 little-endian)
 *   octet  8     : 0x00 fixe — fonction inconnue
 *   octet  9     : variable — fonction inconnue (pas un octet de lecture)
 *   octets 10-11 : canal 1 (int16 LE / 100)
 *   octets 12-13 : canal 2 — température (int16 LE / 100)
 *   octet  14    : variable — fonction inconnue
 *   octets 15-16 : canal 3 (int16 LE / 100)
 *   octets 17-18 : canal 4 (int16 LE / 100)
 *   octets 19+   : canaux additionnels non utilisés, valeur sentinelle
 *                  0xFF9C (= -100 en int16) quand le canal n'est pas actif
 *   3 derniers octets : trailer constant observé (a9 e1 0c) — fonction
 *                  inconnue, ignoré
 *
 * Le TYPE de chaque canal (vide/pression, température, débit, etc.) n'est
 * pas encodé dans `dats` lui-même — il dépend du modèle de capteur
 * (serialNumber) et n'a pas encore été capturé ailleurs dans l'API. Pour
 * l'instant on décode les valeurs brutes sans deviner leur unité tant
 * qu'on n'a pas cette table de correspondance.
 */

const SENTINEL_UNUSED_SLOT = -100 // 0xFF9C — canal non câblé (emplacement générique inutilisé)
const SENTINEL_PORT_ABSENT = 320 // 0x7D00 — port du boîtier non câblé (le boîtier peut en avoir la capacité sans que la ligne y soit branchée)

/**
 * Pourcentage de batterie — validé sur 4 capteurs réels avec valeur
 * affichée à l'écran en parallèle (79%, 79%, 75%, 71%), match exact sans
 * arrondi. L'octet à l'index 14 (absolu, dans les 34 octets du payload
 * complet) encode la batterie : `pct = octet * 4 - 261`.
 * Ce qu'on prenait pour une "constante protocolaire ~78-86" au début de
 * l'exploration était en fait la batterie tout du long.
 */
export function decodeBatteryPercent(b64: string): number | null {
  const bytes = base64ToBytes(b64)
  if (bytes.length < 15) return null
  const raw = bytes[14]
  const pct = raw * 4 - 261
  return Math.max(0, Math.min(100, pct))
}

export interface DecodedChannel {
  index: number
  rawValue: number
  active: boolean
}

export interface DecodedDats {
  timestampMs: number
  channels: DecodedChannel[]
}

function readInt16LE(bytes: Uint8Array, offset: number): number {
  const val = bytes[offset] | (bytes[offset + 1] << 8)
  return val > 0x7fff ? val - 0x10000 : val
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

export function decodeDats(b64: string): DecodedDats {
  const bytes = base64ToBytes(b64)

  // Timestamp : uint64 LE sur 8 octets. JS ne gère pas nativement les
  // uint64 au-delà de 2^53 en bitwise — on le reconstruit via BigInt puis
  // on repasse en Number (les timestamps ms restent bien en dessous de la
  // limite de précision sûre jusqu'à l'an ~285000).
  let tsBig = 0n
  for (let i = 7; i >= 0; i--) {
    tsBig = (tsBig << 8n) | BigInt(bytes[i])
  }
  const timestampMs = Number(tsBig)

  // Offsets connus des canaux de lecture, relatifs au début du buffer.
  const channelOffsets = [10, 12, 15, 17]
  const channels: DecodedChannel[] = channelOffsets.map((offset, i) => {
    const raw = readInt16LE(bytes, offset)
    const value = raw / 100
    const active = raw !== SENTINEL_UNUSED_SLOT && value !== SENTINEL_PORT_ABSENT
    return { index: i, rawValue: value, active }
  })

  // Canaux additionnels inutilisés (sentinelle), à partir de l'octet 19,
  // par blocs de 4 (int16 valeur + 2 octets de remplissage à 0).
  let extraOffset = 19
  let extraIndex = channelOffsets.length
  while (extraOffset + 1 < bytes.length - 3) {
    const raw = readInt16LE(bytes, extraOffset)
    const value = raw / 100
    const active = raw !== SENTINEL_UNUSED_SLOT && value !== SENTINEL_PORT_ABSENT
    channels.push({ index: extraIndex, rawValue: value, active })
    extraOffset += 4
    extraIndex += 1
  }

  return { timestampMs, channels }
}
