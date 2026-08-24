interface Props {
  className?: string
  opacity?: number
}

/**
 * Feuille d'érable stylisée en facettes filaires, avec nœuds lumineux —
 * écho du visuel de marque H2O Innovation. Les "veines" partent de la
 * base (où la tige rejoint le limbe), comme une vraie feuille, plutôt
 * que du centre géométrique — ça évite l'effet "étoile/soleil".
 */
export function MapleLeafGlyph({ className = '', opacity = 1 }: Props) {
  // Silhouette : pointe haute + 3 lobes de chaque côté + tige, avec des
  // échancrures concaves entre chaque lobe (ce qui fait la différence
  // entre une feuille et une étoile symétrique).
  const outline: [number, number][] = [
    [200, 20], // 0  pointe sommet (lobe)
    [232, 65], // 1  échancrure
    [305, 45], // 2  lobe sup. droit
    [272, 115], // 3  échancrure
    [378, 145], // 4  lobe médian droit
    [288, 185], // 5  échancrure
    [350, 245], // 6  lobe inf. droit
    [260, 245], // 7  échancrure
    [280, 325], // 8  base droite
    [218, 315], // 9  tige (épaule droite)
    [200, 400], // 10 pointe de la tige
    [182, 315], // 11 tige (épaule gauche)
    [120, 325], // 12 base gauche
    [140, 245], // 13 échancrure
    [50, 245], // 14 lobe inf. gauche
    [112, 185], // 15 échancrure
    [22, 145], // 16 lobe médian gauche
    [128, 115], // 17 échancrure
    [95, 45], // 18 lobe sup. gauche
    [168, 65], // 19 échancrure
  ]
  const spikeIndices = [0, 2, 4, 6, 14, 16, 18] // les 7 pointes du limbe (pas les échancrures ni la tige)
  const base: [number, number] = [200, 300] // origine des veines, près de l'attache de la tige

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
        opacity="0.75"
        filter="url(#leaf-glow)"
      />

      {/* Veines : de la base vers chaque pointe du limbe, comme une vraie feuille */}
      {spikeIndices.map((i) => (
        <line
          key={i}
          x1={base[0]}
          y1={base[1]}
          x2={outline[i][0]}
          y2={outline[i][1]}
          stroke="var(--color-sap)"
          strokeWidth="0.5"
          opacity="0.3"
        />
      ))}

      {/* Nervures secondaires : quelques liens courts entre pointes voisines pour la texture facettée */}
      {spikeIndices.map((i, idx) => {
        if (idx === spikeIndices.length - 1) return null
        const next = spikeIndices[idx + 1]
        return (
          <line
            key={`s-${i}`}
            x1={outline[i][0]}
            y1={outline[i][1]}
            x2={outline[next][0]}
            y2={outline[next][1]}
            stroke="var(--color-sap)"
            strokeWidth="0.4"
            opacity="0.18"
          />
        )
      })}

      {outline.map(([x, y], i) => {
        const isSpike = spikeIndices.includes(i)
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={isSpike ? 2.4 : 1.2}
            fill="var(--color-sap)"
            filter="url(#leaf-glow)"
            className={isSpike ? 'node-pulse' : ''}
            style={{ animationDelay: `${(i * 173) % 2400}ms` }}
          />
        )
      })}

      <circle cx={base[0]} cy={base[1]} r="2" fill="var(--color-syrup)" filter="url(#leaf-glow)" />
    </svg>
  )
}
