import { getBatteryColor } from '../lib/battery'

export function BatteryIndicator({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)))
  const color = getBatteryColor(clamped)

  return (
    <div className="flex items-center gap-1" title={`Batterie ${clamped}%`}>
      <div className="relative w-4 h-2.5 border rounded-[1px] shrink-0" style={{ borderColor: color }}>
        <div className="absolute inset-y-0 left-0" style={{ width: `${clamped}%`, backgroundColor: color }} />
        <div
          className="absolute top-1/2 -translate-y-1/2"
          style={{ right: '-3px', width: '2px', height: '4px', backgroundColor: color }}
        />
      </div>
      <span className="font-mono text-xs tabular-nums" style={{ color }}>
        {clamped}%
      </span>
    </div>
  )
}
