import { Fragment } from 'react'
import type { Sensor } from '../types/sensor'
import { StatusBadge } from './StatusBadge'
import { DeviceIcon } from './DeviceIcon'
import { getEffectiveStatus, isChannelAlarming } from '../lib/sensorStatus'
import { getSensorTypeLabel, getSensorIconKind } from '../lib/sensorType'
import { getBatteryColor } from '../lib/battery'

type SortOption =
  | 'default'
  | 'name-asc'
  | 'name-desc'
  | 'temp-asc'
  | 'temp-desc'
  | 'vacuum-asc'
  | 'vacuum-desc'
  | 'battery-asc'
  | 'battery-desc'
  | 'status-asc'
  | 'status-desc'
  | 'type-asc'
  | 'type-desc'
  | 'update-asc'
  | 'update-desc'

interface Props {
  sensors: Sensor[]
  allSensors: Sensor[]
  onOpen: (id: string) => void
  sortBy: SortOption
  onSortChange: (sort: SortOption) => void
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('fr-CA', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function SortHeader({
  label,
  ascValue,
  descValue,
  sortBy,
  onSortChange,
  className = '',
}: {
  label: string
  ascValue: SortOption
  descValue: SortOption
  sortBy: SortOption
  onSortChange: (s: SortOption) => void
  className?: string
}) {
  const active = sortBy === ascValue || sortBy === descValue
  return (
    <th
      onClick={() => onSortChange(sortBy === ascValue ? descValue : ascValue)}
      className={`px-2 sm:px-3 py-2 text-left font-mono text-[10px] sm:text-[11px] uppercase tracking-wide cursor-pointer select-none hover:text-sap transition-colors whitespace-nowrap ${
        active ? 'text-sap' : 'text-muted'
      } ${className}`}
    >
      {label} {active && (sortBy === ascValue ? '↑' : '↓')}
    </th>
  )
}

export function SensorTable({ sensors, allSensors, onOpen, sortBy, onSortChange }: Props) {
  return (
    <div className="rounded-lg border border-line overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="bg-panel-raised border-b border-line">
              <th className="px-2 sm:px-3 py-2 text-left font-mono text-[11px] uppercase tracking-wide text-muted w-6 sm:w-8"></th>
              <SortHeader label="Nom" ascValue="name-asc" descValue="name-desc" sortBy={sortBy} onSortChange={onSortChange} />
              <SortHeader label="Statut" ascValue="status-asc" descValue="status-desc" sortBy={sortBy} onSortChange={onSortChange} />
              <SortHeader
                label="Ports (vide)"
                ascValue="vacuum-asc"
                descValue="vacuum-desc"
                sortBy={sortBy}
                onSortChange={onSortChange}
              />
              <SortHeader
                label="Température"
                ascValue="temp-asc"
                descValue="temp-desc"
                sortBy={sortBy}
                onSortChange={onSortChange}
                className="hidden sm:table-cell"
              />
              <SortHeader
                label="Batterie"
                ascValue="battery-asc"
                descValue="battery-desc"
                sortBy={sortBy}
                onSortChange={onSortChange}
                className="hidden sm:table-cell"
              />
              <SortHeader
                label="Type"
                ascValue="type-asc"
                descValue="type-desc"
                sortBy={sortBy}
                onSortChange={onSortChange}
                className="hidden lg:table-cell"
              />
              <SortHeader
                label="Maj"
                ascValue="update-asc"
                descValue="update-desc"
                sortBy={sortBy}
                onSortChange={onSortChange}
                className="hidden lg:table-cell"
              />
            </tr>
          </thead>
          <tbody>
            {sensors.map((sensor, i) => {
              const status = getEffectiveStatus(sensor, allSensors)
              const tempChannel = sensor.channels.find((c) => c.kind === 'temperature')
              const vacuumChannels = sensor.channels.filter((c) => c.kind === 'vacuum')
              const statusColor =
                status === 'online' ? 'var(--color-lime)' : status === 'alarm' ? 'var(--color-danger)' : 'var(--color-danger)'

              return (
                <Fragment key={sensor.id}>
                  <tr
                    onClick={() => onOpen(sensor.id)}
                    style={{ borderLeft: `3px solid ${statusColor}` }}
                    className={`cursor-pointer border-b border-line sm:border-b sm:border-b-line hover:bg-panel-raised transition-colors ${
                      i % 2 === 0 ? 'bg-panel' : 'bg-panel/60'
                    }`}
                  >
                    <td className="px-2 sm:px-3 py-2">
                      <DeviceIcon kind={getSensorIconKind(sensor)} size={16} color="var(--color-sap)" />
                    </td>
                    <td className="px-2 sm:px-3 py-2 font-medium text-sap whitespace-nowrap">{sensor.name}</td>
                    <td className="px-2 sm:px-3 py-2">
                      <StatusBadge status={status} />
                    </td>
                    <td className="px-2 sm:px-3 py-2">
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-xs">
                        {vacuumChannels.length === 0 && <span className="text-muted">—</span>}
                        {vacuumChannels.map((c) => {
                          const alarming = isChannelAlarming(c)
                          const portNum = c.label.match(/\d+/)?.[0] ?? '•'
                          return (
                            <span key={c.id} className={alarming ? 'text-danger' : 'text-text'}>
                              <span className="text-muted">{portNum}:</span> {c.currentValue}
                            </span>
                          )
                        })}
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-2 sm:px-3 py-2 font-mono tabular-nums whitespace-nowrap">
                      {tempChannel ? `${tempChannel.currentValue} °C` : <span className="text-muted">—</span>}
                    </td>
                    <td className="hidden sm:table-cell px-2 sm:px-3 py-2 font-mono tabular-nums whitespace-nowrap">
                      {sensor.batteryPercent !== undefined ? (
                        <span style={{ color: getBatteryColor(sensor.batteryPercent) }}>{sensor.batteryPercent}%</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="hidden lg:table-cell px-2 sm:px-3 py-2 text-muted whitespace-nowrap">
                      {getSensorTypeLabel(sensor)}
                    </td>
                    <td className="hidden lg:table-cell px-2 sm:px-3 py-2 font-mono text-xs text-muted whitespace-nowrap">
                      {formatDateTime(sensor.lastReadingAt)}
                    </td>
                  </tr>
                  {/* Ligne secondaire mobile — regroupe ce que les colonnes cachées contiennent,
                      au lieu de perdre l'info. Invisible dès sm (les vraies colonnes prennent le relais). */}
                  <tr
                    style={{ borderLeft: `3px solid ${statusColor}` }}
                    className={`sm:hidden border-b border-line ${i % 2 === 0 ? 'bg-panel' : 'bg-panel/60'}`}
                  >
                    <td colSpan={4} className="px-2 pb-2 pt-0">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[11px] text-muted">
                        {tempChannel && <span className="text-text">{tempChannel.currentValue} °C</span>}
                        {sensor.batteryPercent !== undefined && (
                          <span style={{ color: getBatteryColor(sensor.batteryPercent) }}>{sensor.batteryPercent}%</span>
                        )}
                        <span>{getSensorTypeLabel(sensor)}</span>
                        <span>{formatDateTime(sensor.lastReadingAt)}</span>
                      </div>
                    </td>
                  </tr>
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
