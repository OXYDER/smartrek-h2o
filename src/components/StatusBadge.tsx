import type { SensorStatus } from '../types/sensor'

const STATUS_CONFIG: Record<SensorStatus, { label: string; dot: string; text: string }> = {
  online: { label: 'En ligne', dot: 'bg-lime', text: 'text-lime' },
  warning: { label: 'Attention', dot: 'bg-syrup', text: 'text-syrup' },
  alarm: { label: 'Alarme', dot: 'bg-danger', text: 'text-danger' },
  offline: { label: 'Hors ligne', dot: 'bg-danger', text: 'text-danger' },
}

export function StatusBadge({ status }: { status: SensorStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wide ${cfg.text}`}>
      <span className={`relative flex h-1.5 w-1.5 ${status === 'alarm' ? 'animate-pulse' : ''}`}>
        <span className={`inline-flex h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      </span>
      {cfg.label}
    </span>
  )
}
