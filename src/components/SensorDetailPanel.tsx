import { useState } from 'react'
import type { AlertChannel, Sensor, ThresholdRule } from '../types/sensor'
import { SENSOR_KIND_LABELS } from '../types/sensor'
import { StatusBadge } from './StatusBadge'
import { Sparkline } from './Sparkline'
import { smartrekClient } from '../api/client'

interface Props {
  sensor: Sensor
  onClose: () => void
  onChange: (sensor: Sensor) => void
  onDelete: (id: string) => void
}

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

export function SensorDetailPanel({ sensor, onClose, onChange, onDelete }: Props) {
  const [name, setName] = useState(sensor.name)
  const [notes, setNotes] = useState(sensor.notes ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function saveName() {
    if (name === sensor.name) return
    const updated = await smartrekClient.updateSensor(sensor.id, { name })
    if (updated) onChange(updated)
  }

  async function saveNotes() {
    if (notes === (sensor.notes ?? '')) return
    const updated = await smartrekClient.updateSensor(sensor.id, { notes })
    if (updated) onChange(updated)
  }

  async function addThreshold() {
    const rule: ThresholdRule = { id: uid(), label: 'Nouveau seuil', max: sensor.currentValue + 5, enabled: true }
    const updated = await smartrekClient.upsertThreshold(sensor.id, rule)
    if (updated) onChange(updated)
  }

  async function patchThreshold(rule: ThresholdRule) {
    const updated = await smartrekClient.upsertThreshold(sensor.id, rule)
    if (updated) onChange(updated)
  }

  async function removeThreshold(id: string) {
    const updated = await smartrekClient.deleteThreshold(sensor.id, id)
    if (updated) onChange(updated)
  }

  async function addAlertChannel() {
    const channel: AlertChannel = { id: uid(), type: 'sms', target: '', enabled: true }
    const updated = await smartrekClient.upsertAlertChannel(sensor.id, channel)
    if (updated) onChange(updated)
  }

  async function patchAlertChannel(channel: AlertChannel) {
    const updated = await smartrekClient.upsertAlertChannel(sensor.id, channel)
    if (updated) onChange(updated)
  }

  async function removeAlertChannel(id: string) {
    const updated = await smartrekClient.deleteAlertChannel(sensor.id, id)
    if (updated) onChange(updated)
  }

  async function handleDelete() {
    await smartrekClient.deleteSensor(sensor.id)
    onDelete(sensor.id)
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-panel border-l border-line flex flex-col overflow-y-auto">
        <div className="p-5 border-b border-line flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-xs font-mono text-muted uppercase tracking-wide">
              {SENSOR_KIND_LABELS[sensor.kind]}
            </p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              className="font-display text-xl bg-transparent border-none outline-none w-full mt-0.5 focus:ring-1 focus:ring-sap rounded px-1 -ml-1"
            />
          </div>
          <button onClick={onClose} className="text-muted hover:text-text text-xl leading-none px-1">
            ×
          </button>
        </div>

        <div className="p-5 flex flex-col gap-6">
          {/* Lecture actuelle */}
          <div className="flex items-center justify-between">
            <div>
              <StatusBadge status={sensor.status} />
              <div className="flex items-baseline gap-1 mt-1">
                <span className="font-mono text-4xl tabular-nums">{sensor.currentValue}</span>
                <span className="font-mono text-base text-muted">{sensor.unit}</span>
              </div>
            </div>
            <Sparkline data={sensor.history} width={140} height={44} />
          </div>

          {/* Seuils */}
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h4 className="font-display text-sm tracking-wide text-muted uppercase">Seuils d'alerte</h4>
              <button onClick={addThreshold} className="text-xs font-mono text-sap hover:underline">
                + Ajouter
              </button>
            </div>
            {sensor.thresholds.length === 0 && (
              <p className="text-sm text-muted italic">Aucun seuil configuré.</p>
            )}
            {sensor.thresholds.map((t) => (
              <div key={t.id} className="rounded border border-line bg-panel-raised p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <input
                    value={t.label}
                    onChange={(e) => patchThreshold({ ...t, label: e.target.value })}
                    className="flex-1 bg-transparent text-sm font-medium outline-none border-b border-transparent focus:border-line"
                  />
                  <label className="flex items-center gap-1.5 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={t.enabled}
                      onChange={(e) => patchThreshold({ ...t, enabled: e.target.checked })}
                      className="accent-sap"
                    />
                    Actif
                  </label>
                  <button
                    onClick={() => removeThreshold(t.id)}
                    className="text-muted hover:text-danger text-sm px-1"
                    aria-label="Supprimer ce seuil"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex gap-3 text-xs font-mono">
                  <label className="flex items-center gap-1.5 text-muted">
                    Min
                    <input
                      type="number"
                      value={t.min ?? ''}
                      onChange={(e) =>
                        patchThreshold({ ...t, min: e.target.value === '' ? undefined : Number(e.target.value) })
                      }
                      placeholder="—"
                      className="w-16 bg-base border border-line rounded px-1.5 py-0.5 outline-none focus:border-sap"
                    />
                  </label>
                  <label className="flex items-center gap-1.5 text-muted">
                    Max
                    <input
                      type="number"
                      value={t.max ?? ''}
                      onChange={(e) =>
                        patchThreshold({ ...t, max: e.target.value === '' ? undefined : Number(e.target.value) })
                      }
                      placeholder="—"
                      className="w-16 bg-base border border-line rounded px-1.5 py-0.5 outline-none focus:border-sap"
                    />
                  </label>
                </div>
              </div>
            ))}
          </section>

          {/* Canaux d'alerte */}
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h4 className="font-display text-sm tracking-wide text-muted uppercase">Notifications</h4>
              <button onClick={addAlertChannel} className="text-xs font-mono text-sap hover:underline">
                + Ajouter
              </button>
            </div>
            {sensor.alertChannels.length === 0 && (
              <p className="text-sm text-muted italic">Aucune notification configurée.</p>
            )}
            {sensor.alertChannels.map((c) => (
              <div key={c.id} className="rounded border border-line bg-panel-raised p-3 flex items-center gap-2">
                <select
                  value={c.type}
                  onChange={(e) => patchAlertChannel({ ...c, type: e.target.value as AlertChannel['type'] })}
                  className="bg-base border border-line rounded px-1.5 py-1 text-xs font-mono outline-none"
                >
                  <option value="sms">SMS</option>
                  <option value="email">Courriel</option>
                  <option value="push">Push</option>
                </select>
                <input
                  value={c.target}
                  onChange={(e) => patchAlertChannel({ ...c, target: e.target.value })}
                  placeholder={c.type === 'email' ? 'adresse@courriel.com' : 'Destinataire'}
                  className="flex-1 bg-transparent text-sm outline-none border-b border-transparent focus:border-line"
                />
                <label className="flex items-center gap-1.5 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={c.enabled}
                    onChange={(e) => patchAlertChannel({ ...c, enabled: e.target.checked })}
                    className="accent-sap"
                  />
                </label>
                <button
                  onClick={() => removeAlertChannel(c.id)}
                  className="text-muted hover:text-danger text-sm px-1"
                  aria-label="Supprimer cette notification"
                >
                  ✕
                </button>
              </div>
            ))}
          </section>

          {/* Notes */}
          <section className="flex flex-col gap-2">
            <h4 className="font-display text-sm tracking-wide text-muted uppercase">Notes</h4>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveNotes}
              rows={3}
              placeholder="Notes internes sur ce capteur…"
              className="bg-panel-raised border border-line rounded p-2 text-sm outline-none focus:border-sap resize-none"
            />
          </section>

          {/* Zone dangereuse */}
          <section className="pt-2 border-t border-line">
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-xs font-mono text-danger/80 hover:text-danger"
              >
                Supprimer ce capteur
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted">Confirmer la suppression ?</span>
                <button onClick={handleDelete} className="text-xs font-mono text-danger hover:underline">
                  Oui, supprimer
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs font-mono text-muted hover:underline"
                >
                  Annuler
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
