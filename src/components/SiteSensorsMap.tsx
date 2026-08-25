import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Sensor, Site } from '../types/sensor'
import { DEVICE_ICON_URLS } from './DeviceIcon'
import type { DeviceIconKind } from './DeviceIcon'
import { getSensorIconKind, getSensorTypeLabel } from '../lib/sensorType'
import { getEffectiveStatus } from '../lib/sensorStatus'
import { addBaseLayers } from '../lib/mapLayers'

interface Props {
  site: Site
  sensors: Sensor[] // déjà filtrés à ce site (et aux filtres actifs)
  allSensors: Sensor[]
  onOpenSensor: (id: string) => void
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

const STATUS_COLOR: Record<string, string> = {
  online: 'var(--color-lime)',
  alarm: 'var(--color-danger)',
  offline: 'var(--color-danger)',
  warning: 'var(--color-syrup)',
}

function deviceDivIcon(kind: DeviceIconKind, color: string, size = 30): L.DivIcon {
  const iconSize = Math.round(size * 0.55)
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:2px solid rgba(255,255,255,0.85);box-shadow:0 0 8px rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;">
      <span style="display:block;width:${iconSize}px;height:${iconSize}px;background-color:#fff;-webkit-mask-image:url(${DEVICE_ICON_URLS[kind]});mask-image:url(${DEVICE_ICON_URLS[kind]});-webkit-mask-size:contain;mask-size:contain;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;"></span>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    tooltipAnchor: [0, -size / 2],
  })
}

function sensorSummary(sensor: Sensor): string {
  const temp = sensor.channels.find((c) => c.kind === 'temperature')
  const vacuum = sensor.channels.filter((c) => c.kind === 'vacuum')
  const parts: string[] = []
  if (vacuum.length > 0) {
    parts.push(vacuum.map((c) => `${c.label.match(/\d+/)?.[0] ?? ''}:${c.currentValue}`).join(' '))
  }
  if (temp) parts.push(`${temp.currentValue}°C`)
  if (sensor.batteryPercent !== undefined) parts.push(`🔋${sensor.batteryPercent}%`)
  return parts.join(' · ') || 'Aucune lecture'
}

export function SiteSensorsMap({ site, sensors, allSensors, onOpenSensor }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, { zoomControl: true }).setView([46.8, -71.3], 15)
    addBaseLayers(map, containerRef.current)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const markers: L.Marker[] = []
    const bounds: [number, number][] = []

    // La passerelle elle-même
    const siteCoords = parseLocation(site.location)
    if (siteCoords) {
      bounds.push(siteCoords)
      const gatewayIcon = deviceDivIcon('repeater', 'var(--color-sap)', 34)
      const marker = L.marker(siteCoords, { icon: gatewayIcon }).addTo(map)
      marker.bindTooltip(
        `<strong>${site.name}</strong><br/>Passerelle · ${site.sensorCount} capteur${site.sensorCount !== 1 ? 's' : ''}`,
        { direction: 'top' }
      )
      markers.push(marker)
    }

    // Les capteurs
    sensors.forEach((sensor) => {
      const coords: [number, number] | null =
        sensor.latitude && sensor.longitude ? [sensor.latitude, sensor.longitude] : null
      if (!coords) return
      bounds.push(coords)
      const status = getEffectiveStatus(sensor, allSensors)
      const icon = deviceDivIcon(getSensorIconKind(sensor), STATUS_COLOR[status] ?? 'var(--color-muted)')
      const marker = L.marker(coords, { icon }).addTo(map)
      marker.bindTooltip(
        `<strong>${sensor.name}</strong><br/>${getSensorTypeLabel(sensor)}<br/>${sensorSummary(sensor)}`,
        { direction: 'top' }
      )
      // Même comportement qu'un clic sur une carte/ligne de tableau — ouvre
      // le panneau de détail standard, pas de traitement spécial pour la carte.
      marker.on('click', () => onOpenSensor(sensor.id))
      markers.push(marker)
    })

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 })
    }

    return () => {
      markers.forEach((m) => m.remove())
    }
  }, [site, sensors, allSensors, onOpenSensor])

  const missingCount = sensors.filter((s) => !(s.latitude && s.longitude)).length

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-lg border border-line overflow-hidden">
        <div ref={containerRef} className="smartrek-map" style={{ height: '60vh', minHeight: 360, width: '100%' }} />
      </div>
      {missingCount > 0 && (
        <p className="text-xs text-muted italic">
          {missingCount} capteur{missingCount !== 1 ? 's' : ''} sans coordonnées GPS individuelles, non affiché
          {missingCount !== 1 ? 's' : ''} sur la carte.
        </p>
      )}
    </div>
  )
}
