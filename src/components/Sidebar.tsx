import { useState } from 'react'
import type { Sensor, Site } from '../types/sensor'
import { SENSOR_CATEGORIES, VACUUM_SUBCATEGORIES, sensorMatchesCategory } from '../lib/sensorCategories'
import { DeviceIcon, type DeviceIconKind } from './DeviceIcon'
import { getSiteStatus } from '../lib/sensorStatus'
import h2oInnovationLogo from '../assets/brand/h2o-innovation-logo.png'

const CATEGORY_ICON: Record<string, DeviceIconKind> = {
  vacuum: 'vacuum',
  level: 'level',
  flow: 'instrument',
  remote: 'remote',
  tensiometer: 'instrument',
}

interface Props {
  sites: Site[]
  sensors: Sensor[]
  activeSiteId: string | null
  activeCategory: string | null
  onSelectAll: () => void
  onSelectCategory: (siteId: string, categoryId: string | null) => void
  onRenameSite: (id: string, name: string) => void
  onLogout: () => void
  open: boolean
  onClose: () => void
  showingDifferentials: boolean
  onShowDifferentials: () => void
  showingStatistics: boolean
  onShowStatistics: () => void
}

function CategoryRow({
  label,
  count,
  active,
  onClick,
  icon,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
  icon?: DeviceIconKind
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
        active ? 'bg-panel-raised text-sap' : 'text-muted hover:text-text'
      }`}
    >
      <span className="flex items-center gap-1.5 min-w-0 truncate">
        {icon && <DeviceIcon kind={icon} size={13} color={active ? 'var(--color-sap)' : 'var(--color-muted)'} />}
        <span className="truncate">{label}</span>
      </span>
      <span
        className={`font-mono text-[10px] w-5 h-5 shrink-0 flex items-center justify-center rounded-full border ${
          active ? 'border-sap text-sap' : 'border-line text-muted'
        }`}
      >
        {count}
      </span>
    </button>
  )
}

export function Sidebar({
  sites,
  sensors,
  activeSiteId,
  activeCategory,
  onSelectAll,
  onSelectCategory,
  onRenameSite,
  onLogout,
  open,
  onClose,
  showingDifferentials,
  onShowDifferentials,
  showingStatistics,
  onShowStatistics,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [expandedSiteId, setExpandedSiteId] = useState<string | null>(null)
  const [vacuumExpanded, setVacuumExpanded] = useState(false)

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

  function toggleSite(site: Site) {
    const willExpand = expandedSiteId !== site.id
    setExpandedSiteId(willExpand ? site.id : null)
    setVacuumExpanded(false)
    if (willExpand) {
      onSelectCategory(site.id, null)
    }
  }

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={onClose} aria-hidden="true" />}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 md:w-56 shrink-0 border-r border-line bg-panel flex flex-col transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
        <div className="p-4 border-b border-line flex items-start justify-between gap-2">
          <div>
            <img
              src={h2oInnovationLogo}
              alt="H2O Innovation"
              className="h-7 w-auto object-contain"
              style={{ filter: 'drop-shadow(0 0 12px rgba(41,171,226,0.35))' }}
            />
            <p className="text-xs font-mono text-muted mt-1">Client Smartrek H2O</p>
          </div>
          <button
            onClick={onClose}
            className="md:hidden text-muted hover:text-text text-xl leading-none px-1 shrink-0"
            aria-label="Fermer le menu"
          >
            ×
          </button>
        </div>
        <nav className="flex-1 p-2 flex flex-col gap-0.5 overflow-y-auto">
          <button
            onClick={() => {
              setExpandedSiteId(null)
              onSelectAll()
              onClose()
            }}
            className={`text-left text-sm px-3 py-2 rounded transition-colors ${
              !showingDifferentials && !showingStatistics && activeSiteId === null
                ? 'bg-panel-raised text-sap'
                : 'text-muted hover:text-text'
            }`}
          >
            Tous les sites
          </button>
          <button
            onClick={() => {
              onShowDifferentials()
              onClose()
            }}
            className={`text-left text-sm px-3 py-2 rounded transition-colors ${
              showingDifferentials ? 'bg-panel-raised text-sap' : 'text-muted hover:text-text'
            }`}
          >
            Différentiels
          </button>
          <button
            onClick={() => {
              onShowStatistics()
              onClose()
            }}
            className={`text-left text-sm px-3 py-2 rounded transition-colors ${
              showingStatistics ? 'bg-panel-raised text-sap' : 'text-muted hover:text-text'
            }`}
          >
            Statistiques
          </button>
          {sites.map((site, i) => {
            const siteSensors = sensors.filter((s) => s.siteId === site.id)
            const isExpanded = expandedSiteId === site.id
            return (
              <div key={site.id}>
                <div
                  onClick={() => editingId !== site.id && toggleSite(site)}
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
                      <div className="min-w-0 flex items-center gap-1.5">
                        <span className="text-xs text-muted shrink-0">{isExpanded ? '▾' : '▸'}</span>
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{
                            backgroundColor:
                              getSiteStatus(site.id, sensors) === 'online' ? 'var(--color-lime)' : 'var(--color-danger)',
                            boxShadow: `0 0 4px 0.5px ${getSiteStatus(site.id, sensors) === 'online' ? 'rgba(140,224,76,0.7)' : 'rgba(225,69,61,0.7)'}`,
                          }}
                          title={getSiteStatus(site.id, sensors) === 'online' ? 'En ligne' : 'Hors ligne'}
                        />
                        <div className="min-w-0">
                          <div className="text-sm truncate">{site.name}</div>
                          <div className="text-xs font-mono opacity-70">Passerelle · {site.location}</div>
                        </div>
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

                {isExpanded && (
                  <div className="pl-2 flex flex-col gap-0.5 py-1">
                    <p className="px-3 py-1 text-[10px] font-mono uppercase tracking-wide text-muted">Capteurs</p>
                    <CategoryRow
                      label="Tous les capteurs"
                      count={siteSensors.length}
                      active={activeSiteId === site.id && activeCategory === null}
                      onClick={() => {
                        onSelectCategory(site.id, null)
                        onClose()
                      }}
                    />
                    {SENSOR_CATEGORIES.map((cat) => {
                      const count = siteSensors.filter((s) => sensorMatchesCategory(s, cat.id)).length
                      if (cat.id === 'vacuum') {
                        const vacuumActive = activeSiteId === site.id && activeCategory === 'vacuum'
                        return (
                          <div key={cat.id}>
                            <button
                              onClick={() => setVacuumExpanded((v) => !v)}
                              className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
                                vacuumActive ? 'bg-panel-raised text-sap' : 'text-muted hover:text-text'
                              }`}
                            >
                              <span className="flex items-center gap-1.5 min-w-0 truncate">
                                <span className="text-[10px] shrink-0">{vacuumExpanded ? '▾' : '▸'}</span>
                                <DeviceIcon
                                  kind="vacuum"
                                  size={13}
                                  color={vacuumActive ? 'var(--color-sap)' : 'var(--color-muted)'}
                                />
                                <span className="truncate">{cat.label}</span>
                              </span>
                              <span
                                className={`font-mono text-[10px] w-5 h-5 shrink-0 flex items-center justify-center rounded-full border ${
                                  vacuumActive ? 'border-sap text-sap' : 'border-line text-muted'
                                }`}
                              >
                                {count}
                              </span>
                            </button>
                            {vacuumExpanded && (
                              <div className="pl-4 flex flex-col gap-0.5">
                                <CategoryRow
                                  label="Tous les vacuum"
                                  count={count}
                                  active={vacuumActive}
                                  onClick={() => {
                                    onSelectCategory(site.id, 'vacuum')
                                    onClose()
                                  }}
                                />
                                {VACUUM_SUBCATEGORIES.map((sub) => (
                                  <CategoryRow
                                    key={sub.id}
                                    label={sub.label}
                                    count={siteSensors.filter((s) => sensorMatchesCategory(s, sub.id)).length}
                                    active={activeSiteId === site.id && activeCategory === sub.id}
                                    onClick={() => {
                                      onSelectCategory(site.id, sub.id)
                                      onClose()
                                    }}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      }
                      return (
                        <CategoryRow
                          key={cat.id}
                          label={cat.label}
                          count={count}
                          icon={CATEGORY_ICON[cat.id]}
                          active={activeSiteId === site.id && activeCategory === cat.id}
                          onClick={() => {
                            onSelectCategory(site.id, cat.id)
                            onClose()
                          }}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
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
    </>
  )
}
