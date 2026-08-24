import { useEffect, useMemo, useState } from 'react'
import type { Sensor, SensorStatus, Site } from '../types/sensor'
import { smartrekClient } from '../api/client'
import { Sidebar } from '../components/Sidebar'
import { SensorCard } from '../components/SensorCard'
import { SensorDetailPanel } from '../components/SensorDetailPanel'
import { NewSensorModal } from '../components/NewSensorModal'

const STATUS_FILTERS: { value: SensorStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'alarm', label: 'Alarmes' },
  { value: 'warning', label: 'Attention' },
  { value: 'online', label: 'En ligne' },
  { value: 'offline', label: 'Hors ligne' },
]

export function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [sites, setSites] = useState<Site[]>([])
  const [sensors, setSensors] = useState<Sensor[]>([])
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<SensorStatus | 'all'>('all')
  const [openSensorId, setOpenSensorId] = useState<string | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [bootError, setBootError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

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
    return sensors.filter((s) => {
      if (activeSiteId && s.siteId !== activeSiteId) return false
      if (statusFilter !== 'all' && s.status !== statusFilter) return false
      return true
    })
  }, [sensors, activeSiteId, statusFilter])

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

  const alarmCount = sensors.filter((s) => s.status === 'alarm').length

  return (
    <div className="flex h-screen bg-base text-text">
      <Sidebar
        sites={sites}
        activeSiteId={activeSiteId}
        onSelect={setActiveSiteId}
        onRenameSite={renameSite}
        onLogout={onLogout}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="border-b border-line px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl">
              {activeSiteId ? sites.find((s) => s.id === activeSiteId)?.name : 'Tous les capteurs'}
            </h1>
            <p className="text-sm text-muted font-mono">
              {filtered.length} capteur{filtered.length !== 1 ? 's' : ''}
              {alarmCount > 0 && <span className="text-danger"> · {alarmCount} en alarme</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-sm border border-line text-muted hover:text-text px-3 py-2 rounded transition-colors disabled:opacity-40"
            >
              {refreshing ? 'Actualisation…' : '↻ Actualiser'}
            </button>
            <button
              onClick={() => setShowNewModal(true)}
              className="bg-sap text-base text-sm font-medium px-4 py-2 rounded hover:opacity-90 transition-opacity"
            >
              + Nouveau capteur
            </button>
          </div>
        </header>

        {bootError && (
          <div className="px-6 py-3 bg-danger/10 border-b border-danger/30 text-sm text-danger">
            <strong>Échec de chargement des données Smartrek :</strong> {bootError}
          </div>
        )}

        <div className="px-6 py-3 border-b border-line flex gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`text-xs font-mono px-3 py-1.5 rounded-full border transition-colors ${
                statusFilter === f.value
                  ? 'border-sap text-sap bg-sap/10'
                  : 'border-line text-muted hover:text-text'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <p className="text-muted font-mono text-sm">Chargement…</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="font-display text-lg text-muted">Aucun capteur ici.</p>
              <p className="text-sm text-muted mt-1">Ajuste les filtres ou ajoute un nouveau capteur.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((sensor) => (
                <SensorCard key={sensor.id} sensor={sensor} onOpen={() => setOpenSensorId(sensor.id)} />
              ))}
            </div>
          )}
        </div>
      </main>

      {openSensor && (
        <SensorDetailPanel
          sensor={openSensor}
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
