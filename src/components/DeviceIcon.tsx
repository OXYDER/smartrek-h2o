import vacuumIcon from '../assets/icons/vacuum.png'
import repeaterIcon from '../assets/icons/repeater.png'
import remoteIcon from '../assets/icons/wireless-control.png'
import levelIcon from '../assets/icons/water-level.png'
import instrumentIcon from '../assets/icons/instrument.png'

const ICONS = {
  vacuum: vacuumIcon,
  repeater: repeaterIcon,
  remote: remoteIcon,
  level: levelIcon,
  instrument: instrumentIcon,
} as const

export type DeviceIconKind = keyof typeof ICONS

interface Props {
  kind: DeviceIconKind
  size?: number
  color?: string
  className?: string
}

/**
 * Icônes fournies par le client (PNG noir sur fond transparent). Recolorées
 * via masque CSS (background-color + mask-image) plutôt qu'affichées
 * telles quelles, pour qu'elles suivent les couleurs du thème et restent
 * nettes à n'importe quelle taille.
 */
export function DeviceIcon({ kind, size = 16, color = 'currentColor', className = '' }: Props) {
  return (
    <span
      className={className}
      role="img"
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        flexShrink: 0,
        backgroundColor: color,
        WebkitMaskImage: `url(${ICONS[kind]})`,
        maskImage: `url(${ICONS[kind]})`,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
    />
  )
}
