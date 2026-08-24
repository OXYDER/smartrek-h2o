interface Props {
  className?: string
  opacity?: number
}

/**
 * Feuille d'érable stylisée en facettes filaires, avec nœuds lumineux —
 * écho du visuel de marque H2O Innovation (constellation + feuille
 * géométrique), sans reproduire leur illustration exacte.
 */
export function MapleLeafGlyph({ className = '', opacity = 1 }: Props) {
  const outline = [
    [200, 20], // pointe sommet
    [240, 108],
    [332, 88],
    [268, 168],
    [362, 228],
    [258, 218],
    [300, 342],
    [214, 300],
    [206, 340],
    [200, 398],
    [194, 340],
    [186, 300],
    [100, 342],
    [142, 218],
    [38, 228],
    [132, 168],
    [68, 88],
    [160, 108],
  ]
  const center: [number, number] = [200, 210]

  const facetLines = outline.map((p, i) => [center, p, outline[(i + 1) % outline.length]])

  const outlinePath = `M${outline.map((p) => p.join(',')).join(' L')} Z`

  return (
    <svg
      viewBox="0 0 400 420"
      className={className}
      style={{ opacity }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter id="leaf-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <path
        d={outlinePath}
        fill="none"
        stroke="var(--color-sap)"
        strokeWidth="1.5"
        opacity="0.7"
        filter="url(#leaf-glow)"
      />

      {facetLines.map(([a, b, c], i) => (
        <g key={i} stroke="var(--color-sap)" strokeWidth="0.5" opacity="0.28">
          <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
          <line x1={a[0]} y1={a[1]} x2={c[0]} y2={c[1]} />
        </g>
      ))}

      {outline.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={i % 3 === 0 ? 2.2 : 1.3}
          fill="var(--color-sap)"
          filter="url(#leaf-glow)"
          className={i % 4 === 0 ? 'node-pulse' : ''}
          style={{ animationDelay: `${(i * 137) % 2400}ms` }}
        />
      ))}

      <circle cx={center[0]} cy={center[1]} r="1.5" fill="var(--color-syrup)" filter="url(#leaf-glow)" />
    </svg>
  )
}
