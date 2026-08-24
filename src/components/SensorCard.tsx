import type { Sensor } from '../types/sensor'
import { SENSOR_KIND_LABELS } from '../types/sensor'
import { StatusBadge } from './StatusBadge'
import { Sparkline } from './Sparkline'

const STATUS_LINE_COLOR: Record<Sensor['status'], string> = {
  online: 'var(--color-sap)',
  warning: 'var(--color-syrup)',
  alarm: 'var(--color-danger)',
  offline: 'var(--color-muted)',
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })
}

export function SensorCard({ sensor, onOpen }: { sensor: Sensor; onOpen: () => void }) {
  const alarmingThreshold = sensor.thresholds.find(
    (t) =>
      t.enabled &&
      ((t.max !== undefined && sensor.currentValue >= t.max) ||
        (t.min !== undefined && sensor.currentValue <= t.min))
  )

  return (
    <button
      onClick={onOpen}
      className="group relative text-left rounded-lg border border-line bg-panel hover:bg-panel-raised transition-colors p-4 flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-mono text-muted uppercase tracking-wide">
            {SENSOR_KIND_LABELS[sensor.kind]}
          </p>
          <h3 className="font-display text-lg leading-tight mt-0.5 group-hover:text-sap transition-colors">
            {sensor.name}
          </h3>
        </div>
        <StatusBadge status={sensor.status} />
      </div>

      <div className="flex items-end justify-between gap-2">
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-3xl tabular-nums">{sensor.currentValue}</span>
          <span className="font-mono text-sm text-muted">{sensor.unit}</span>
        </div>
        <Sparkline data={sensor.history} color={STATUS_LINE_COLOR[sensor.status]} width={110} height={32} />
      </div>

      {alarmingThreshold && (
        <p className="text-xs font-mono text-danger">
          ⚠ Seuil « {alarmingThreshold.label} » dépassé
        </p>
      )}

      <div className="flex items-center justify-between text-xs font-mono text-muted pt-2 border-t border-line">
        <span>Maj {formatTime(sensor.lastReadingAt)}</span>
        <span>{sensor.thresholds.length} seuil{sensor.thresholds.length !== 1 ? 's' : ''}</span>
      </div>
    </button>
  )
}
