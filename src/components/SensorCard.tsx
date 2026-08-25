import type { Sensor } from '../types/sensor'
import { StatusBadge } from './StatusBadge'
import { BatteryIndicator } from './BatteryIndicator'
import { DeviceIcon } from './DeviceIcon'
import { getEffectiveStatus, isChannelAlarming } from '../lib/sensorStatus'
import { getSensorTypeLabel, getSensorIconKind } from '../lib/sensorType'
import { getPortDifferential } from '../lib/differential'

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('fr-CA', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const STATUS_BORDER: Record<string, string> = {
  online: 'var(--color-lime)',
  alarm: 'var(--color-danger)',
  offline: 'var(--color-danger)',
  warning: 'var(--color-syrup)',
}

export function SensorCard({
  sensor,
  allSensors,
  onOpen,
}: {
  sensor: Sensor
  allSensors: Sensor[]
  onOpen: () => void
}) {
  const status = getEffectiveStatus(sensor, allSensors)
  const hasAlarm = sensor.channels.some(isChannelAlarming)
  const tempChannel = sensor.channels.find((c) => c.kind === 'temperature')
  const otherChannels = sensor.channels.filter((c) => c.kind !== 'temperature')

  return (
    <button
      onClick={onOpen}
      style={{ borderLeftColor: STATUS_BORDER[status], borderLeftWidth: 3 }}
      className="group relative text-left rounded-lg border border-line bg-panel hover:bg-panel-raised hover:shadow-[0_0_20px_-4px_var(--color-sap)] transition-all p-4 flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <DeviceIcon kind={getSensorIconKind(sensor)} size={20} color="var(--color-sap)" />
          <h3 className="font-display font-semibold text-lg leading-tight text-sap truncate">{sensor.name}</h3>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <StatusBadge status={status} />
          <div className="flex items-center gap-2">
            {sensor.batteryPercent !== undefined && <BatteryIndicator percent={sensor.batteryPercent} />}
            {tempChannel && (
              <span className="font-mono text-sm tabular-nums text-text">
                {tempChannel.currentValue}
                <span className="text-muted text-xs ml-0.5">{tempChannel.unit}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {otherChannels.length > 0 && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {otherChannels.map((c) => {
            const alarming = isChannelAlarming(c)
            const portNumber = c.label.match(/\d+/)?.[0] ?? '•'
            const diff = c.kind === 'vacuum' ? getPortDifferential(sensor, c, allSensors) : undefined
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
                  {diff !== undefined && (
                    <span className="text-muted text-xs ml-1">
                      ({diff > 0 ? '+' : ''}
                      {diff})
                    </span>
                  )}
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
