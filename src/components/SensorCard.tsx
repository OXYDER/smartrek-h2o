import type { Sensor } from '../types/sensor'
import { StatusBadge } from './StatusBadge'
import { getSensorStatus, isChannelAlarming } from '../lib/sensorStatus'
import { getSensorTypeLabel } from '../lib/sensorType'

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('fr-CA', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function SensorCard({ sensor, onOpen }: { sensor: Sensor; onOpen: () => void }) {
  const status = getSensorStatus(sensor)
  const hasAlarm = sensor.channels.some(isChannelAlarming)
  const tempChannel = sensor.channels.find((c) => c.kind === 'temperature')
  const otherChannels = sensor.channels.filter((c) => c.kind !== 'temperature')

  return (
    <button
      onClick={onOpen}
      className="group relative text-left rounded-lg border border-line bg-panel hover:bg-panel-raised transition-colors p-4 flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display font-semibold text-lg leading-tight text-sap">{sensor.name}</h3>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <StatusBadge status={status} />
          {tempChannel && (
            <span className="font-mono text-sm tabular-nums text-text">
              {tempChannel.currentValue}
              <span className="text-muted text-xs ml-0.5">{tempChannel.unit}</span>
            </span>
          )}
        </div>
      </div>

      {otherChannels.length > 0 && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {otherChannels.map((c) => {
            const alarming = isChannelAlarming(c)
            const portNumber = c.label.match(/\d+/)?.[0] ?? '•'
            return (
              <div key={c.id} className="flex items-baseline gap-1.5 min-w-0">
                <span
                  className={`font-mono text-[10px] w-4 h-4 shrink-0 flex items-center justify-center rounded-full border ${
                    alarming ? 'border-danger text-danger' : 'border-line text-muted'
                  }`}
                >
                  {portNumber}
                </span>
                <span className={`font-mono text-sm tabular-nums truncate ${alarming ? 'text-danger' : ''}`}>
                  {c.currentValue}
                  <span className="text-muted text-xs ml-0.5">{c.unit}</span>
                </span>
              </div>
            )
          })}
        </div>
      )}

      {hasAlarm && <p className="text-xs font-mono text-danger">⚠ Seuil dépassé</p>}

      <div className="flex items-center justify-between text-xs font-mono text-muted pt-2 border-t border-line">
        <span>Maj {formatDateTime(sensor.lastReadingAt)}</span>
        <span>{getSensorTypeLabel(sensor)}</span>
      </div>
    </button>
  )
}
