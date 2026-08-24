import type { Sensor } from '../types/sensor'
import { CHANNEL_KIND_ABBR } from '../types/sensor'
import { StatusBadge } from './StatusBadge'

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })
}

function isChannelAlarming(channel: Sensor['channels'][number]) {
  return channel.thresholds.some(
    (t) =>
      t.enabled &&
      ((t.max !== undefined && channel.currentValue >= t.max) ||
        (t.min !== undefined && channel.currentValue <= t.min))
  )
}

export function SensorCard({ sensor, onOpen }: { sensor: Sensor; onOpen: () => void }) {
  const hasAlarm = sensor.channels.some(isChannelAlarming)

  return (
    <button
      onClick={onOpen}
      className="group relative text-left rounded-lg border border-line bg-panel hover:bg-panel-raised transition-colors p-4 flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display font-semibold text-lg leading-tight group-hover:text-sap transition-colors">
          {sensor.name}
        </h3>
        <StatusBadge status={sensor.status} />
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {sensor.channels.map((c) => {
          const alarming = isChannelAlarming(c)
          return (
            <div key={c.id} className="flex items-baseline gap-1.5 min-w-0">
              <span
                className={`font-mono text-[10px] w-4 h-4 shrink-0 flex items-center justify-center rounded-full border ${
                  alarming ? 'border-danger text-danger' : 'border-line text-muted'
                }`}
              >
                {CHANNEL_KIND_ABBR[c.kind]}
              </span>
              <span className={`font-mono text-sm tabular-nums truncate ${alarming ? 'text-danger' : ''}`}>
                {c.currentValue}
                <span className="text-muted text-xs ml-0.5">{c.unit}</span>
              </span>
            </div>
          )
        })}
      </div>

      {hasAlarm && <p className="text-xs font-mono text-danger">⚠ Seuil dépassé</p>}

      <div className="flex items-center justify-between text-xs font-mono text-muted pt-2 border-t border-line">
        <span>Maj {formatTime(sensor.lastReadingAt)}</span>
        <span>{sensor.channels.length} canal{sensor.channels.length !== 1 ? 'aux' : ''}</span>
      </div>
    </button>
  )
}
