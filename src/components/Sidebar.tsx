import type { Site } from '../types/sensor'

interface Props {
  sites: Site[]
  activeSiteId: string | null
  onSelect: (siteId: string | null) => void
  onLogout: () => void
}

export function Sidebar({ sites, activeSiteId, onSelect, onLogout }: Props) {
  return (
    <aside className="w-56 shrink-0 border-r border-line bg-panel flex flex-col">
      <div className="p-4 border-b border-line">
        <p className="font-display font-semibold text-lg leading-tight tracking-tight">
          h<span className="text-sap">2</span>o <span className="text-muted font-normal text-base">smartrek</span>
        </p>
        <p className="text-xs font-mono text-muted">Division Érablière</p>
      </div>
      <nav className="flex-1 p-2 flex flex-col gap-0.5">
        <button
          onClick={() => onSelect(null)}
          className={`text-left text-sm px-3 py-2 rounded transition-colors ${
            activeSiteId === null ? 'bg-panel-raised text-sap' : 'text-muted hover:text-text'
          }`}
        >
          Tous les sites
        </button>
        {sites.map((site) => (
          <button
            key={site.id}
            onClick={() => onSelect(site.id)}
            className={`text-left px-3 py-2 rounded transition-colors ${
              activeSiteId === site.id ? 'bg-panel-raised text-sap' : 'text-muted hover:text-text'
            }`}
          >
            <div className="text-sm">{site.name}</div>
            <div className="text-xs font-mono opacity-70">{site.location}</div>
          </button>
        ))}
      </nav>
      <div className="p-2 border-t border-line">
        <button
          onClick={onLogout}
          className="w-full text-left text-sm px-3 py-2 rounded text-muted hover:text-danger transition-colors"
        >
          Se déconnecter
        </button>
      </div>
    </aside>
  )
}
