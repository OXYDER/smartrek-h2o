import type { SensorStatus } from '../types/sensor'

const STATUS_CONFIG: Record<SensorStatus, { label: string; dot: string; text: string; glow: string }> = {
  online: { label: 'En ligne', dot: 'bg-lime', text: 'text-lime', glow: 'rgba(140,224,76,0.7)' },
  warning: { label: 'Attention', dot: 'bg-syrup', text: 'text-syrup', glow: 'rgba(232,85,46,0.7)' },
  alarm: { label: 'Alarme', dot: 'bg-danger', text: 'text-danger', glow: 'rgba(225,69,61,0.7)' },
  offline: { label: 'Hors ligne', dot: 'bg-danger', text: 'text-danger', glow: 'rgba(225,69,61,0.5)' },
}

export function StatusBadge({ status }: { status: SensorStatus }) {
  const cfg = STATUS_CONFIG[status]
  const pulsing = status === 'online' || status === 'alarm'
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wide ${cfg.text}`}>
      <span
        className={`inline-flex h-1.5 w-1.5 rounded-full ${cfg.dot} ${pulsing ? 'animate-pulse' : ''}`}
        style={{ boxShadow: `0 0 6px 1px ${cfg.glow}` }}
      />
      {cfg.label}
    </span>
  )
}
