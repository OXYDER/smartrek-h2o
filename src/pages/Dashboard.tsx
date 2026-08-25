import { useEffect, useMemo, useState } from 'react'
import type { Sensor, SensorStatus, Site } from '../types/sensor'
import { smartrekClient } from '../api/client'
import { Sidebar } from '../components/Sidebar'
import { SensorCard } from '../components/SensorCard'
import { SensorTable } from '../components/SensorTable'
import { SitesMap } from '../components/SitesMap'
import { SiteSensorsMap } from '../components/SiteSensorsMap'
import { SensorDetailPanel } from '../components/SensorDetailPanel'
import { NewSensorModal } from '../components/NewSensorModal'
import { Dropdown } from '../components/Dropdown'
import { getEffectiveStatus } from '../lib/sensorStatus'
import { getSensorTypeLabel } from '../lib/sensorType'
import { sensorMatchesCategory, SENSOR_CATEGORIES, VACUUM_SUBCATEGORIES } from '../lib/sensorCategories'

type SortOption =
  | 'default'
  | 'name-asc'
  | 'name-desc'
  | 'temp-asc'
  | 'temp-desc'
  | 'vacuum-asc'
  | 'vacuum-desc'
  | 'battery-asc'
  | 'battery-desc'
  | 'status-asc'
  | 'status-desc'
  | 'type-asc'
  | 'type-desc'
  | 'update-asc'
  | 'update-desc'

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'default', label: 'Trier par' },
  { value: 'name-asc', label: 'Nom Ascendant' },
  { value: 'name-desc', label: 'Nom Descendant' },
  { value: 'temp-asc', label: 'Température Ascendant' },
  { value: 'temp-desc', label: 'Température Descendant' },
  { value: 'vacuum-asc', label: 'Vide inHg Ascendant' },
  { value: 'vacuum-desc', label: 'Vide inHg Descendant' },
  { value: 'battery-asc', label: 'Batterie Ascendant' },
  { value: 'battery-desc', label: 'Batterie Descendant' },
]

const FILTER_OPTIONS: { value: SensorStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Filtrer' },
  { value: 'online', label: 'En Ligne' },
  { value: 'offline', label: 'Hors Ligne' },
  { value: 'alarm', label: 'Alarme' },
]

export function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [sites, setSites] = useState<Site[]>([])
  const [sensors, setSensors] = useState<Sensor[]>([])
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<SensorStatus | 'all'>('all')
  const [sortBy, setSortBy] = useState<SortOption>('default')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'map'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'grid' : 'table'
  )
  const [openSensorId, setOpenSensorId] = useState<string | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [bootError, setBootError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function loadData() {
    const [s, se] = await Promise.all([smartrekClient.listSites(), smartrekClient.listSensors()])
    setSites(s)
    setSensors(se)
    setBootError(smartrekClient.getBootError())
  }

  useEffect(() => {
    loadData().finally(() => setLoading(false))
  }, [])

  async function handleRefresh() {
    setRefreshing(true)
    await smartrekClient.refreshBoot()
    await loadData()
    setRefreshing(false)
  }

  const filtered = useMemo(() => {
    const result = sensors.filter((s) => {
      if (activeSiteId && s.siteId !== activeSiteId) return false
      if (activeCategory && !sensorMatchesCategory(s, activeCategory)) return false
      if (statusFilter !== 'all' && getEffectiveStatus(s, sensors) !== statusFilter) return false
      if (searchQuery.trim() && !s.name.toLowerCase().includes(searchQuery.trim().toLowerCase())) return false
      return true
    })

    if (sortBy === 'default') return result

    const getTemp = (s: Sensor) => s.channels.find((c) => c.kind === 'temperature')?.currentValue
    const getVacuum = (s: Sensor) => s.channels.find((c) => c.kind === 'vacuum')?.currentValue
    const STATUS_RANK: Record<string, number> = { alarm: 0, offline: 1, warning: 2, online: 3 }

    const sorted = [...result]
    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return a.name.localeCompare(b.name, 'fr')
        case 'name-desc':
          return b.name.localeCompare(a.name, 'fr')
        case 'temp-asc':
        case 'temp-desc': {
          const av = getTemp(a)
          const bv = getTemp(b)
          if (av === undefined && bv === undefined) return 0
          if (av === undefined) return 1
          if (bv === undefined) return -1
          return sortBy === 'temp-asc' ? av - bv : bv - av
        }
        case 'vacuum-asc':
        case 'vacuum-desc': {
          const av = getVacuum(a)
          const bv = getVacuum(b)
          if (av === undefined && bv === undefined) return 0
          if (av === undefined) return 1
          if (bv === undefined) return -1
          return sortBy === 'vacuum-asc' ? av - bv : bv - av
        }
        case 'battery-asc':
        case 'battery-desc': {
          const av = a.batteryPercent
          const bv = b.batteryPercent
          if (av === undefined && bv === undefined) return 0
          if (av === undefined) return 1
          if (bv === undefined) return -1
          return sortBy === 'battery-asc' ? av - bv : bv - av
        }
        case 'status-asc':
        case 'status-desc': {
          const av = STATUS_RANK[getEffectiveStatus(a, sensors)]
          const bv = STATUS_RANK[getEffectiveStatus(b, sensors)]
          return sortBy === 'status-asc' ? av - bv : bv - av
        }
        case 'type-asc':
        case 'type-desc': {
          const av = getSensorTypeLabel(a)
          const bv = getSensorTypeLabel(b)
          return sortBy === 'type-asc' ? av.localeCompare(bv, 'fr') : bv.localeCompare(av, 'fr')
        }
        case 'update-asc':
        case 'update-desc': {
          const av = new Date(a.lastReadingAt).getTime()
          const bv = new Date(b.lastReadingAt).getTime()
          return sortBy === 'update-asc' ? av - bv : bv - av
        }
        default:
          return 0
      }
    })
    return sorted
  }, [sensors, activeSiteId, activeCategory, statusFilter, sortBy, searchQuery])

  const openSensor = sensors.find((s) => s.id === openSensorId) ?? null

  function updateSensorInList(updated: Sensor) {
    setSensors((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
  }

  async function renameSite(id: string, name: string) {
    const updated = await smartrekClient.updateSite(id, { name })
    if (updated) {
      setSites((prev) => prev.map((s) => (s.id === id ? updated : s)))
    }
  }

  function removeSensorFromList(id: string) {
    setSensors((prev) => prev.filter((s) => s.id !== id))
    setOpenSensorId(null)
  }

  const alarmCount = sensors.filter((s) => getEffectiveStatus(s, sensors) === 'alarm').length

  return (
    <div className="flex h-dvh bg-base text-text">
      <Sidebar
        sites={sites}
        sensors={sensors}
        activeSiteId={activeSiteId}
        activeCategory={activeCategory}
        onSelectAll={() => {
          setActiveSiteId(null)
          setActiveCategory(null)
        }}
        onSelectCategory={(siteId, categoryId) => {
          setActiveSiteId(siteId)
          setActiveCategory(categoryId)
        }}
        onRenameSite={renameSite}
        onLogout={onLogout}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        viewMode={viewMode}
        onShowMap={() => {
          setActiveSiteId(null)
          setActiveCategory(null)
          setViewMode('map')
        }}
        onShowSiteMap={(siteId) => {
          setActiveSiteId(siteId)
          setActiveCategory(null)
          setViewMode('map')
        }}
      />

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="border-b border-line px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden shrink-0 p-1.5 -ml-1 text-muted hover:text-text text-xl leading-none"
              aria-label="Ouvrir le menu des sites"
            >
              ☰
            </button>
            <div className="min-w-0">
              <h1 className="font-display text-lg sm:text-2xl truncate">
                {viewMode === 'map' && !activeSiteId
                  ? 'Carte des passerelles'
                  : activeSiteId
                    ? sites.find((s) => s.id === activeSiteId)?.name
                    : 'Tous les capteurs'}
                {viewMode === 'map' && activeSiteId && <span className="text-muted"> — Carte</span>}
                {viewMode !== 'map' && activeCategory && (
                  <span className="text-muted">
                    {' '}
                    —{' '}
                    {SENSOR_CATEGORIES.find((c) => c.id === activeCategory)?.label ??
                      VACUUM_SUBCATEGORIES.find((c) => c.id === activeCategory)?.label}
                  </span>
                )}
              </h1>
              <p className="text-xs sm:text-sm text-muted font-mono truncate">
                {viewMode === 'map' && !activeSiteId ? (
                  `${sites.length} site${sites.length !== 1 ? 's' : ''}`
                ) : (
                  <>
                    {filtered.length} capteur{filtered.length !== 1 ? 's' : ''}
                    {alarmCount > 0 && <span className="text-danger"> · {alarmCount} en alarme</span>}
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-sm border border-line text-muted hover:text-text px-2.5 sm:px-3 py-2 rounded transition-colors disabled:opacity-40"
              aria-label="Actualiser"
            >
              <span className="sm:hidden">↻</span>
              <span className="hidden sm:inline">{refreshing ? 'Actualisation…' : '↻ Actualiser'}</span>
            </button>
            <button
              onClick={() => setShowNewModal(true)}
              className="bg-sap text-base text-sm font-medium px-2.5 sm:px-4 py-2 rounded hover:opacity-90 transition-opacity"
              aria-label="Nouveau capteur"
            >
              <span className="sm:hidden">+</span>
              <span className="hidden sm:inline">+ Nouveau capteur</span>
            </button>
          </div>
        </header>

        {bootError && (
          <div className="px-3 sm:px-6 py-3 bg-danger/10 border-b border-danger/30 text-sm text-danger">
            <strong>Échec de chargement des données Smartrek :</strong> {bootError}
          </div>
        )}

        <div className="px-3 sm:px-6 py-3 border-b border-line flex flex-wrap items-center gap-2">
          {viewMode !== 'map' && (
            <>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrer par nom…"
                className="text-xs font-mono bg-panel border border-line rounded-full px-3 py-1.5 outline-none focus:border-sap w-40 sm:w-56"
              />
              <Dropdown label="Trier par" options={SORT_OPTIONS} value={sortBy} onChange={(v) => setSortBy(v as SortOption)} />
              <Dropdown
                label="Filtrer"
                options={FILTER_OPTIONS}
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as SensorStatus | 'all')}
              />
            </>
          )}
          <div className="ml-auto flex gap-1 shrink-0">
            <button
              onClick={() => setViewMode('table')}
              className={`text-xs font-mono px-3 py-1.5 rounded-full border transition-colors ${
                viewMode === 'table' ? 'border-sap text-sap bg-sap/10' : 'border-line text-muted hover:text-text'
              }`}
            >
              ☰ Tableau
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`text-xs font-mono px-3 py-1.5 rounded-full border transition-colors ${
                viewMode === 'grid' ? 'border-sap text-sap bg-sap/10' : 'border-line text-muted hover:text-text'
              }`}
            >
              ▦ Grille
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`text-xs font-mono px-3 py-1.5 rounded-full border transition-colors ${
                viewMode === 'map' ? 'border-sap text-sap bg-sap/10' : 'border-line text-muted hover:text-text'
              }`}
            >
              🗺 Carte
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-canvas">
          {viewMode === 'map' && !activeSiteId ? (
            <SitesMap
              sites={sites}
              onSelectSite={(id) => {
                setActiveSiteId(id)
                setActiveCategory(null)
              }}
              onPlaceSite={async (siteId, lat, lng) => {
                const updated = await smartrekClient.updateSite(siteId, { location: `${lat}, ${lng}` })
                if (updated) {
                  setSites((prev) => prev.map((s) => (s.id === siteId ? updated : s)))
                }
              }}
            />
          ) : viewMode === 'map' && activeSiteId ? (
            (() => {
              const site = sites.find((s) => s.id === activeSiteId)
              return site ? (
                <SiteSensorsMap
                  site={site}
                  sensors={filtered}
                  allSensors={sensors}
                  onSensorChange={updateSensorInList}
                  onSensorDelete={removeSensorFromList}
                />
              ) : null
            })()
          ) : loading ? (
            <p className="text-muted font-mono text-sm">Chargement…</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="font-display text-lg text-muted">Aucun capteur ici.</p>
              <p className="text-sm text-muted mt-1">Ajuste les filtres ou ajoute un nouveau capteur.</p>
            </div>
          ) : viewMode === 'table' ? (
            <SensorTable
              sensors={filtered}
              allSensors={sensors}
              onOpen={setOpenSensorId}
              sortBy={sortBy}
              onSortChange={setSortBy}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {filtered.map((sensor) => (
                <SensorCard key={sensor.id} sensor={sensor} allSensors={sensors} onOpen={() => setOpenSensorId(sensor.id)} />
              ))}
            </div>
          )}
        </div>
      </main>

      {openSensor && (
        <SensorDetailPanel
          sensor={openSensor}
          allSensors={sensors}
          onClose={() => setOpenSensorId(null)}
          onChange={updateSensorInList}
          onDelete={removeSensorFromList}
        />
      )}

      {showNewModal && (
        <NewSensorModal
          siteId={activeSiteId ?? sites[0]?.id ?? 'site-ham-nord'}
          onClose={() => setShowNewModal(false)}
          onCreated={(sensor) => {
            setSensors((prev) => [...prev, sensor])
            setShowNewModal(false)
          }}
        />
      )}
    </div>
  )
}
