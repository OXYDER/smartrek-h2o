import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import type { Site } from '../types/sensor'

// Vite ne résout pas les URLs relatives des icônes par défaut de Leaflet —
// on les réimporte explicitement comme assets.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

interface Props {
  sites: Site[]
  onSelectSite: (id: string) => void
  onPlaceSite: (siteId: string, lat: number, lng: number) => void
}

function parseLocation(location: string): [number, number] | null {
  const parts = location.split(',').map((s) => s.trim())
  if (parts.length !== 2) return null
  const lat = Number(parts[0])
  const lng = Number(parts[1])
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null
  if (lat === 0 && lng === 0) return null
  return [lat, lng]
}

export function SitesMap({ sites, onSelectSite, onPlaceSite }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const [placingSiteId, setPlacingSiteId] = useState<string | null>(null)
  const placingSiteIdRef = useRef<string | null>(null)
  placingSiteIdRef.current = placingSiteId

  // Init une seule fois
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, { zoomControl: true }).setView([46.8, -71.3], 8)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)
    map.on('click', (e: L.LeafletMouseEvent) => {
      const activeSiteId = placingSiteIdRef.current
      if (!activeSiteId) return
      onPlaceSite(activeSiteId, Math.round(e.latlng.lat * 1e6) / 1e6, Math.round(e.latlng.lng * 1e6) / 1e6)
      setPlacingSiteId(null)
    })
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [onPlaceSite])

  // Marqueurs — recréés quand la liste des sites change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const markers: L.Marker[] = []
    const bounds: [number, number][] = []

    sites.forEach((site) => {
      const coords = parseLocation(site.location)
      if (!coords) return
      bounds.push(coords)
      const marker = L.marker(coords).addTo(map)
      marker.bindPopup(
        `<strong>${site.name}</strong><br/>${site.sensorCount} capteur${site.sensorCount !== 1 ? 's' : ''}`
      )
      marker.on('click', () => onSelectSite(site.id))
      markers.push(marker)
    })

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
    }

    return () => {
      markers.forEach((m) => m.remove())
    }
  }, [sites, onSelectSite])

  const sitesWithCoords = sites.filter((s) => parseLocation(s.location))
  const sitesWithoutCoords = sites.filter((s) => !parseLocation(s.location))

  return (
    <div className="flex flex-col gap-3">
      {placingSiteId && (
        <div className="rounded-lg border border-sap bg-sap/10 px-3 py-2 text-sm text-sap flex items-center justify-between gap-2">
          <span>
            Clique sur la carte pour positionner « {sites.find((s) => s.id === placingSiteId)?.name} »
          </span>
          <button onClick={() => setPlacingSiteId(null)} className="text-xs font-mono hover:underline shrink-0">
            Annuler
          </button>
        </div>
      )}

      <div className="rounded-lg border border-line overflow-hidden">
        <div
          ref={containerRef}
          className="smartrek-map"
          style={{ height: '60vh', minHeight: 360, width: '100%', cursor: placingSiteId ? 'crosshair' : '' }}
        />
        {sitesWithCoords.length === 0 && !placingSiteId && (
          <p className="text-sm text-muted italic p-4">
            Aucune passerelle avec coordonnées GPS valides pour l'instant.
          </p>
        )}
      </div>

      {sitesWithoutCoords.length > 0 && (
        <div className="rounded-lg border border-line bg-panel p-3 flex flex-col gap-2">
          <h4 className="font-display text-sm tracking-wide text-muted uppercase">
            Sites sans coordonnées ({sitesWithoutCoords.length})
          </h4>
          {sitesWithoutCoords.map((site) => (
            <div key={site.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{site.name}</span>
              <button
                onClick={() => setPlacingSiteId(site.id)}
                disabled={placingSiteId === site.id}
                className="text-xs font-mono text-sap hover:underline shrink-0 disabled:opacity-50"
              >
                📍 Placer sur la carte
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
