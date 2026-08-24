interface Props {
  className?: string
  opacity?: number
}

/**
 * Feuille d'érable géométrique low-poly avec halo lumineux — fournie
 * directement par le client (design final approuvé), intégrée telle
 * quelle. Le rectangle de fond utilise var(--color-base) au lieu d'une
 * couleur fixe pour se fondre exactement avec le fond de la page.
 *
 * Note : les id (glow, leafFill, mapleLeaf, leafClip) doivent rester
 * uniques dans le DOM — si ce glyphe est utilisé à plus d'un endroit sur
 * la même page en même temps, il faudra suffixer ces id dynamiquement.
 */
export function MapleLeafGlyph({ className = '', opacity = 1 }: Props) {
  return (
    <svg
      viewBox="0 0 1000 1000"
      className={className}
      style={{ opacity }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <linearGradient id="leafFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-sap)" stopOpacity="0.16" />
          <stop offset="50%" stopColor="var(--color-panel-raised)" stopOpacity="0.08" />
          <stop offset="100%" stopColor="var(--color-sap)" stopOpacity="0.15" />
        </linearGradient>

        <path
          id="mapleLeaf"
          d="
            M500 65

            L441 205
            Q436 218 423 210
            L360 168

            L397 360
            Q402 382 384 391
            Q373 396 362 385

            L302 326
            L297 370
            Q295 385 280 380
            L155 343

            L197 462
            Q202 477 186 481
            L140 492

            L329 636
            Q340 644 334 657

            L304 726
            L461 697
            Q478 694 478 711

            L474 885
            L526 885
            L522 711

            Q522 694 539 697
            L696 726
            L666 657
            Q660 644 671 636

            L860 492
            L814 481
            Q798 477 803 462
            L845 343

            L720 380
            Q705 385 703 370
            L698 326

            L638 385
            Q627 396 616 391
            Q598 382 603 360

            L640 168
            L577 210
            Q564 218 559 205

            Z
          "
        />

        <clipPath id="leafClip">
          <use href="#mapleLeaf" />
        </clipPath>
      </defs>

      {/* Fond — se fond avec l'arrière-plan de la page */}
      <rect width="1000" height="1000" fill="var(--color-base)" />

      {/* Halo */}
      <use href="#mapleLeaf" fill="none" stroke="var(--color-sap)" strokeWidth="12" opacity=".35" filter="url(#glow)" />

      {/* Feuille */}
      <use
        href="#mapleLeaf"
        fill="url(#leafFill)"
        stroke="var(--color-sap)"
        strokeWidth="3"
        strokeLinejoin="round"
        filter="url(#glow)"
      />

      {/* Réseau low-poly */}
      <g clipPath="url(#leafClip)" fill="none" stroke="var(--color-sap)" strokeWidth="1.2" strokeOpacity=".65">
        <path d="M500 65 L500 700" />

        <path d="M500 65 L441 205" />
        <path d="M500 65 L559 205" />

        <path d="M441 205 L500 245" />
        <path d="M559 205 L500 245" />

        <path d="M360 168 L441 205" />
        <path d="M640 168 L559 205" />

        <path d="M360 168 L397 360" />
        <path d="M640 168 L603 360" />

        <path d="M441 205 L397 360" />
        <path d="M559 205 L603 360" />

        <path d="M397 360 L500 300" />
        <path d="M603 360 L500 300" />

        <path d="M302 326 L397 360" />
        <path d="M155 343 L302 326" />
        <path d="M155 343 L197 462" />
        <path d="M197 462 L302 420" />
        <path d="M302 326 L302 420" />
        <path d="M302 420 L397 360" />

        <path d="M140 492 L197 462" />
        <path d="M140 492 L329 636" />
        <path d="M197 462 L370 500" />
        <path d="M302 420 L370 500" />
        <path d="M397 360 L370 500" />

        <path d="M698 326 L603 360" />
        <path d="M845 343 L698 326" />
        <path d="M845 343 L803 462" />
        <path d="M803 462 L698 420" />
        <path d="M698 326 L698 420" />
        <path d="M698 420 L603 360" />

        <path d="M860 492 L803 462" />
        <path d="M860 492 L671 636" />
        <path d="M803 462 L630 500" />
        <path d="M698 420 L630 500" />
        <path d="M603 360 L630 500" />

        <path d="M397 360 L500 420" />
        <path d="M603 360 L500 420" />

        <path d="M370 500 L500 420" />
        <path d="M630 500 L500 420" />

        <path d="M370 500 L500 550" />
        <path d="M630 500 L500 550" />

        <path d="M329 636 L370 500" />
        <path d="M671 636 L630 500" />

        <path d="M329 636 L500 550" />
        <path d="M671 636 L500 550" />

        <path d="M329 636 L461 697" />
        <path d="M671 636 L539 697" />

        <path d="M304 726 L461 697" />
        <path d="M696 726 L539 697" />

        <path d="M461 697 L500 620" />
        <path d="M539 697 L500 620" />

        <path d="M329 636 L500 620" />
        <path d="M671 636 L500 620" />

        <path d="M478 711 L500 620" />
        <path d="M522 711 L500 620" />
        <path d="M474 885 L500 711" />
        <path d="M526 885 L500 711" />

        <path d="M360 168 L500 420" />
        <path d="M640 168 L500 420" />

        <path d="M155 343 L500 550" />
        <path d="M845 343 L500 550" />

        <path d="M140 492 L500 620" />
        <path d="M860 492 L500 620" />
      </g>

      {/* Nœuds lumineux */}
      <g fill="var(--color-text)" filter="url(#glow)">
        <circle cx="500" cy="65" r="3" />
        <circle cx="441" cy="205" r="2.5" />
        <circle cx="559" cy="205" r="2.5" />

        <circle cx="397" cy="360" r="3" />
        <circle cx="603" cy="360" r="3" />

        <circle cx="302" cy="420" r="2.5" />
        <circle cx="698" cy="420" r="2.5" />

        <circle cx="370" cy="500" r="3" />
        <circle cx="630" cy="500" r="3" />

        <circle cx="500" cy="420" r="3.5" />
        <circle cx="500" cy="550" r="3.5" />
        <circle cx="500" cy="620" r="3.5" />

        <circle cx="329" cy="636" r="2.5" />
        <circle cx="671" cy="636" r="2.5" />
      </g>

      {/* Petites particules */}
      <g fill="var(--color-sap)" filter="url(#glow)">
        <circle cx="330" cy="120" r="1.5" />
        <circle cx="385" cy="95" r="1" />
        <circle cx="430" cy="115" r="1.5" />

        <circle cx="570" cy="105" r="1" />
        <circle cx="625" cy="125" r="1.5" />
        <circle cx="680" cy="100" r="1" />

        <circle cx="110" cy="370" r="1.5" />
        <circle cx="120" cy="430" r="1" />
        <circle cx="165" cy="550" r="1.5" />

        <circle cx="890" cy="370" r="1.5" />
        <circle cx="880" cy="430" r="1" />
        <circle cx="835" cy="550" r="1.5" />

        <circle cx="270" cy="680" r="1" />
        <circle cx="350" cy="745" r="1.5" />
        <circle cx="650" cy="745" r="1.5" />
        <circle cx="730" cy="680" r="1" />
      </g>
    </svg>
  )
}
