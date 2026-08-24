import { useState } from 'react'
import type { Site } from '../types/sensor'

interface Props {
  sites: Site[]
  activeSiteId: string | null
  onSelect: (siteId: string | null) => void
  onRenameSite: (id: string, name: string) => void
  onLogout: () => void
}

export function Sidebar({ sites, activeSiteId, onSelect, onRenameSite, onLogout }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')

  function startEditing(site: Site, e: React.MouseEvent) {
    e.stopPropagation()
    setEditingId(site.id)
    setDraftName(site.name)
  }

  function commitEdit() {
    if (editingId && draftName.trim()) {
      onRenameSite(editingId, draftName.trim())
    }
    setEditingId(null)
  }

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
        {sites.map((site, i) => (
          <div
            key={site.id}
            onClick={() => editingId !== site.id && onSelect(site.id)}
            className={`group text-left px-3 py-2 rounded transition-colors cursor-pointer ${
              activeSiteId === site.id
                ? 'bg-panel-raised text-sap'
                : `text-muted hover:text-text ${i % 2 === 0 ? 'bg-transparent' : 'bg-panel-raised/40'}`
            }`}
          >
            {editingId === site.id ? (
              <input
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEdit()
                  if (e.key === 'Escape') setEditingId(null)
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-full bg-base border border-sap rounded px-1.5 py-0.5 text-sm text-text outline-none"
              />
            ) : (
              <div className="flex items-center justify-between gap-1">
                <div className="min-w-0">
                  <div className="text-sm truncate">{site.name}</div>
                  <div className="text-xs font-mono opacity-70">Passerelle · {site.location}</div>
                </div>
                <button
                  onClick={(e) => startEditing(site, e)}
                  className="opacity-0 group-hover:opacity-100 text-xs shrink-0 hover:text-sap transition-opacity"
                  aria-label={`Renommer ${site.name}`}
                  title="Renommer"
                >
                  ✎
                </button>
              </div>
            )}
          </div>
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
