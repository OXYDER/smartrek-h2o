import { useState } from 'react'
import type { SensorKind } from '../types/sensor'
import { SENSOR_KIND_LABELS, SENSOR_KIND_UNITS } from '../types/sensor'
import { smartrekClient } from '../api/client'
import type { Sensor } from '../types/sensor'

interface Props {
  siteId: string
  onClose: () => void
  onCreated: (sensor: Sensor) => void
}

export function NewSensorModal({ siteId, onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<SensorKind>('temperature')
  const [creating, setCreating] = useState(false)

  async function handleCreate() {
    if (!name.trim()) return
    setCreating(true)
    const sensor = await smartrekClient.createSensor({
      name: name.trim(),
      kind,
      siteId,
      unit: SENSOR_KIND_UNITS[kind],
      currentValue: 0,
      status: 'offline',
      thresholds: [],
      alertChannels: [],
    })
    setCreating(false)
    onCreated(sensor)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-panel border border-line rounded-lg p-5 flex flex-col gap-4">
        <h3 className="font-display text-lg">Nouveau capteur</h3>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted text-xs font-mono uppercase">Nom</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex. Évaporateur — Sonde nord"
            className="bg-panel-raised border border-line rounded px-2 py-1.5 outline-none focus:border-sap"
            autoFocus
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted text-xs font-mono uppercase">Type</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as SensorKind)}
            className="bg-panel-raised border border-line rounded px-2 py-1.5 outline-none focus:border-sap"
          >
            {Object.entries(SENSOR_KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label} ({SENSOR_KIND_UNITS[value as SensorKind]})
              </option>
            ))}
          </select>
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="text-sm text-muted hover:text-text px-3 py-1.5">
            Annuler
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || creating}
            className="text-sm bg-sap text-base font-medium px-3 py-1.5 rounded disabled:opacity-40"
          >
            {creating ? 'Création…' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  )
}
