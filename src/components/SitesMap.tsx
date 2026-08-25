import { useEffect, useRef } from 'react'
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

export function SitesMap({ sites, onSelectSite }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)

  // Init une seule fois
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, { zoomControl: true }).setView([46.8, -71.3], 8)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

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

  return (
    <div className="rounded-lg border border-line overflow-hidden">
      <div ref={containerRef} className="smartrek-map" style={{ height: '60vh', minHeight: 360, width: '100%' }} />
      {sitesWithCoords.length === 0 && (
        <p className="text-sm text-muted italic p-4">
          Aucune passerelle avec coordonnées GPS valides pour l'instant.
        </p>
      )}
    </div>
  )
}
