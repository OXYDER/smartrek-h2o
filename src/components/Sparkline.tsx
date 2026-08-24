interface Props {
  data: { t: string; v: number }[]
  color?: string
  width?: number
  height?: number
}

export function Sparkline({ data, color = 'var(--color-sap)', width = 160, height = 40 }: Props) {
  if (data.length < 2) return <div style={{ width, height }} />

  const values = data.map((d) => d.v)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((d.v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  })

  const path = `M${points.join(' L')}`
  const areaPath = `${path} L${width},${height} L0,${height} Z`

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id="sparkline-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#sparkline-fill)" stroke="none" />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" className="sap-line" />
    </svg>
  )
}
