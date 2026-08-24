import { useState } from 'react'
import type { ChannelKind, Sensor } from '../types/sensor'
import { CHANNEL_KIND_LABELS, CHANNEL_KIND_UNITS } from '../types/sensor'
import { smartrekClient } from '../api/client'

interface Props {
  siteId: string
  onClose: () => void
  onCreated: (sensor: Sensor) => void
}

export function NewSensorModal({ siteId, onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<ChannelKind>('vacuum')
  const [portCount, setPortCount] = useState(1)
  const [includeTemp, setIncludeTemp] = useState(true)
  const [creating, setCreating] = useState(false)

  const isVacuum = kind === 'vacuum'

  async function handleCreate() {
    if (!name.trim()) return
    setCreating(true)

    const channels = isVacuum
      ? [
          ...Array.from({ length: portCount }, (_, i) => ({
            label: `Port ${i + 1}`,
            kind: 'vacuum' as ChannelKind,
            unit: CHANNEL_KIND_UNITS.vacuum,
          })),
          ...(includeTemp
            ? [{ label: 'Température', kind: 'temperature' as ChannelKind, unit: CHANNEL_KIND_UNITS.temperature }]
            : []),
        ]
      : [{ label: CHANNEL_KIND_LABELS[kind], kind, unit: CHANNEL_KIND_UNITS[kind] }]

    const sensor = await smartrekClient.createSensor({ name: name.trim(), siteId, channels })
    setCreating(false)
    onCreated(sensor)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-panel border border-line rounded-lg p-5 flex flex-col gap-4">
        <h3 className="font-display font-semibold text-lg">Nouveau capteur</h3>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted text-xs font-mono uppercase">Nom</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex. 16-17-18"
            className="bg-panel-raised border border-line rounded px-2 py-1.5 outline-none focus:border-sap"
            autoFocus
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted text-xs font-mono uppercase">Type</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as ChannelKind)}
            className="bg-panel-raised border border-line rounded px-2 py-1.5 outline-none focus:border-sap"
          >
            {Object.entries(CHANNEL_KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label} ({CHANNEL_KIND_UNITS[value as ChannelKind]})
              </option>
            ))}
          </select>
        </label>

        {isVacuum && (
          <>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted text-xs font-mono uppercase">Nombre de ports (tubulure 5/16")</span>
              <div className="flex gap-2">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPortCount(n)}
                    className={`flex-1 py-1.5 rounded border text-sm font-mono transition-colors ${
                      portCount === n
                        ? 'border-sap text-sap bg-sap/10'
                        : 'border-line text-muted hover:text-text'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeTemp}
                onChange={(e) => setIncludeTemp(e.target.checked)}
                className="accent-sap"
              />
              Inclure la sonde de température intégrée
            </label>
          </>
        )}

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
