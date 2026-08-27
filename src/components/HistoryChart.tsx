import { useEffect, useState } from 'react'
import { fetchChannelHistory } from '../api/overlayClient'

interface Props {
  channelId: string
  unit: string
  width?: number
  height?: number
}

function formatTime(t: number) {
  return new Date(t).toLocaleString('fr-CA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function HistoryChart({ channelId, unit, width = 640, height = 220 }: Props) {
  const [points, setPoints] = useState<{ t: number; v: number }[] | null>(null)

  useEffect(() => {
    let cancelled = false
    setPoints(null)
    fetchChannelHistory(channelId).then((pts) => {
      if (!cancelled) setPoints(pts)
    })
    return () => {
      cancelled = true
    }
  }, [channelId])

  if (points === null) {
    return <p className="text-sm text-muted font-mono">Chargement de l'historique…</p>
  }

  if (points.length === 0) {
    return (
      <p className="text-sm text-muted italic">
        Aucun historique pour ce canal pour l'instant — il commence à s'accumuler à partir de maintenant.
      </p>
    )
  }

  const padding = { top: 16, right: 16, bottom: 28, left: 48 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom

  const values = points.map((p) => p.v)
  const minV = Math.min(...values)
  const maxV = Math.max(...values)
  const rangeV = maxV - minV || 1
  const minT = points[0].t
  const maxT = points[points.length - 1].t
  const rangeT = maxT - minT || 1

  const coords = points.map((p) => {
    const x = padding.left + ((p.t - minT) / rangeT) * innerW
    const y = padding.top + innerH - ((p.v - minV) / rangeV) * innerH
    return [x, y] as const
  })

  const linePath = `M${coords.map(([x, y]) => `${x},${y}`).join(' L')}`
  const areaPath = `${linePath} L${coords[coords.length - 1][0]},${padding.top + innerH} L${coords[0][0]},${padding.top + innerH} Z`

  const yTicks = [minV, minV + rangeV / 2, maxV]
  const xTickCount = Math.min(4, points.length)
  const xTicks = Array.from({ length: xTickCount }, (_, i) => {
    const idx = Math.round((i / Math.max(1, xTickCount - 1)) * (points.length - 1))
    return points[idx]
  })

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height}>
      {yTicks.map((v, i) => {
        const y = padding.top + innerH - ((v - minV) / rangeV) * innerH
        return (
          <g key={i}>
            <line
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="var(--color-line)"
              strokeWidth="1"
            />
            <text
              x={padding.left - 8}
              y={y}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted"
              fontSize="10"
              fontFamily="var(--font-mono)"
            >
              {Math.round(v * 100) / 100}
            </text>
          </g>
        )
      })}

      {xTicks.map((p, i) => {
        const x = padding.left + ((p.t - minT) / rangeT) * innerW
        return (
          <text
            key={i}
            x={x}
            y={height - 8}
            textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}
            className="fill-muted"
            fontSize="9"
            fontFamily="var(--font-mono)"
          >
            {formatTime(p.t)}
          </text>
        )
      })}

      <defs>
        <linearGradient id={`hist-fill-${channelId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-sap)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--color-sap)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#hist-fill-${channelId})`} stroke="none" />
      <path d={linePath} fill="none" stroke="var(--color-sap)" strokeWidth="1.5" />
      {coords.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2" fill="var(--color-sap)" />
      ))}

      <text
        x={width - padding.right}
        y={padding.top - 4}
        textAnchor="end"
        className="fill-muted"
        fontSize="10"
        fontFamily="var(--font-mono)"
      >
        {unit}
      </text>
    </svg>
  )
}
