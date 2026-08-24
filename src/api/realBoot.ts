import type { ChannelKind, Sensor, SensorChannel, Site } from '../types/sensor'
import { CHANNEL_KIND_UNITS } from '../types/sensor'
import { decodeDats } from './decodeDats'
import { getCachedToken, getUserId, API_BASE } from './auth'

/**
 * Mapping row_item → Sensor/Site à partir de la réponse réelle de
 * POST {API_BASE}/v2/boot (voir docs/api-notes.md pour le détail complet).
 *
 * Chaque entrée de `nodes[].row_items` avec type === 5 est la passerelle
 * (= le site). Les entrées type === 0 dans le même groupe sont ses
 * capteurs. Chaque capteur est décodé via decodeDats().
 *
 * ⚠️ Le pattern de canaux ci-dessous (vide/température/vide/vide) n'est
 * confirmé que pour les capteurs de vide — le seul type capturé jusqu'ici.
 * D'autres types de capteurs (niveau, débit, humidité) auront probablement
 * une disposition différente dans `dats`, à capturer et ajuster plus tard.
 */
const CHANNEL_PATTERN: { kind: ChannelKind; label: string }[] = [
  { kind: 'vacuum', label: 'Vide 1' },
  { kind: 'temperature', label: 'Température' },
  { kind: 'vacuum', label: 'Vide 2' },
  { kind: 'vacuum', label: 'Vide 3' },
]

interface RawRowItem {
  id: number
  type: number
  mac?: string
  name: string | number
  serialNumber?: string
  latitude?: number
  longitude?: number
  dats: string
  timestamp: string
}

interface RawBootTable {
  table: string
  row_items: RawRowItem[]
}

interface RawBootResponse {
  nodes: RawBootTable[]
}

function mapSensor(item: RawRowItem, siteId: string): Sensor {
  const decoded = decodeDats(item.dats)
  const channels: SensorChannel[] = []

  decoded.channels.forEach((ch, i) => {
    if (!ch.active) return
    const pattern = CHANNEL_PATTERN[i] ?? { kind: 'vacuum' as ChannelKind, label: `Canal ${i + 1}` }
    channels.push({
      id: `${item.id}-ch${i}`,
      label: pattern.label,
      kind: pattern.kind,
      unit: CHANNEL_KIND_UNITS[pattern.kind],
      currentValue: ch.rawValue,
      history: [{ t: new Date(decoded.timestampMs).toISOString(), v: ch.rawValue }],
      thresholds: [],
    })
  })

  return {
    id: String(item.id),
    name: String(item.name),
    mac: item.mac,
    serialNumber: item.serialNumber,
    siteId,
    status: channels.length > 0 ? 'online' : 'offline',
    lastReadingAt: new Date(decoded.timestampMs).toISOString(),
    channels,
    notificationChannels: [],
  }
}

function mapSite(item: RawRowItem): Site {
  const lat = item.latitude ? (item.latitude / 1e6).toFixed(5) : '?'
  const lng = item.longitude ? (item.longitude / 1e6).toFixed(5) : '?'
  return {
    id: String(item.id),
    name: String(item.name),
    location: `${lat}, ${lng}`,
    sensorCount: 0,
  }
}

export interface BootResult {
  sites: Site[]
  sensors: Sensor[]
}

export async function fetchBoot(): Promise<BootResult> {
  const token = getCachedToken()
  const userId = getUserId()
  if (!token || !userId) {
    throw new Error('Non authentifié — reconnecte-toi.')
  }

  let res: Response
  try {
    res = await fetch(`${API_BASE}/v2/boot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userId }),
    })
  } catch {
    throw new Error(
      "Échec réseau vers l'API Smartrek — possible blocage CORS depuis ce domaine (voir README, section proxy)."
    )
  }

  if (!res.ok) {
    throw new Error(`/boot a répondu ${res.status} ${res.statusText}`)
  }

  const data: RawBootResponse = await res.json()
  const sites: Site[] = []
  const sensors: Sensor[] = []

  for (const table of data.nodes ?? []) {
    const items = table.row_items ?? []
    const gatewayItem = items.find((it) => it.type === 5)
    if (!gatewayItem) continue

    const site = mapSite(gatewayItem)
    const siteSensors = items.filter((it) => it.type === 0).map((it) => mapSensor(it, site.id))
    site.sensorCount = siteSensors.length

    sites.push(site)
    sensors.push(...siteSensors)
  }

  return { sites, sensors }
}
