import type { PortDifferentialConfig, Sensor, Site, ThresholdRule } from '../types/sensor'

/**
 * Client pour NOTRE serveur (server/index.js), pas Smartrek. Stocke la
 * config locale (seuils, différentiel, notes, renommages) dans un fichier
 * JSON sur le NAS, séparé de tout ce qui vient de Smartrek — rien de ceci
 * n'est jamais renvoyé à leur API. Requêtes relatives (`/api/...`) car
 * servi par le même processus Node que le frontend.
 */

interface SensorOverlay {
  name?: string
  notes?: string
  channels?: Record<string, { thresholds?: ThresholdRule[]; differential?: PortDifferentialConfig | null }>
}

interface SiteOverlay {
  name?: string
  location?: string
}

export interface Overlay {
  sensors: Record<string, SensorOverlay>
  sites: Record<string, SiteOverlay>
}

export async function fetchOverlay(): Promise<Overlay> {
  try {
    const res = await fetch('/api/overlay')
    if (!res.ok) return { sensors: {}, sites: {} }
    return await res.json()
  } catch {
    return { sensors: {}, sites: {} }
  }
}

export async function saveSensorOverlay(id: string, patch: SensorOverlay): Promise<void> {
  try {
    await fetch(`/api/overlay/sensor/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
  } catch {
    // best-effort — la config reste appliquée en mémoire même si la sauvegarde échoue
  }
}

export async function saveSiteOverlay(id: string, patch: SiteOverlay): Promise<void> {
  try {
    await fetch(`/api/overlay/site/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
  } catch {
    // best-effort
  }
}

/** Applique l'overlay local par-dessus les données fraîches de Smartrek. */
export function applyOverlay(sites: Site[], sensors: Sensor[], overlay: Overlay): { sites: Site[]; sensors: Sensor[] } {
  const mergedSites = sites.map((s) => {
    const o = overlay.sites[s.id]
    if (!o) return s
    return { ...s, ...(o.name !== undefined ? { name: o.name } : {}), ...(o.location !== undefined ? { location: o.location } : {}) }
  })

  const mergedSensors = sensors.map((sensor) => {
    const o = overlay.sensors[sensor.id]
    if (!o) return sensor
    const channels = sensor.channels.map((c) => {
      const co = o.channels?.[c.id]
      if (!co) return c
      return {
        ...c,
        thresholds: co.thresholds ?? c.thresholds,
        differential: 'differential' in co ? (co.differential ?? undefined) : c.differential,
      }
    })
    return {
      ...sensor,
      ...(o.name !== undefined ? { name: o.name } : {}),
      ...(o.notes !== undefined ? { notes: o.notes } : {}),
      channels,
    }
  })

  return { sites: mergedSites, sensors: mergedSensors }
}

/** Envoie les lectures actuelles vers l'historique — dédupliqué et throttlé
 * côté serveur (ne stocke que ce qui change, ou au minimum toutes les 5 min). */
export async function logHistory(sensors: Sensor[]): Promise<void> {
  const now = Date.now()
  const points = sensors.flatMap((sensor) =>
    sensor.channels.map((c) => ({ channelId: c.id, t: now, v: c.currentValue }))
  )
  if (points.length === 0) return
  try {
    await fetch('/api/history/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points }),
    })
  } catch {
    // best-effort
  }
}

export async function fetchChannelHistory(channelId: string): Promise<{ t: number; v: number }[]> {
  try {
    const res = await fetch(`/api/history/${channelId}`)
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}
