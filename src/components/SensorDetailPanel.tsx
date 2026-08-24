import { useState } from 'react'
import type { NotificationChannel, Sensor, ThresholdRule } from '../types/sensor'
import { CHANNEL_KIND_ABBR } from '../types/sensor'
import { StatusBadge } from './StatusBadge'
import { Sparkline } from './Sparkline'
import { smartrekClient } from '../api/client'
import { getSensorStatus, isChannelAlarming } from '../lib/sensorStatus'

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

  const status = getSensorStatus(sensor)
  const tempChannel = sensor.channels.find((c) => c.kind === 'temperature')

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

  async function addThreshold(channelId: string, currentValue: number) {
    const rule: ThresholdRule = { id: uid(), label: 'Nouveau seuil', max: currentValue + 5, enabled: true }
    const updated = await smartrekClient.upsertThreshold(sensor.id, channelId, rule)
    if (updated) onChange(updated)
  }

  async function patchThreshold(channelId: string, rule: ThresholdRule) {
    const updated = await smartrekClient.upsertThreshold(sensor.id, channelId, rule)
    if (updated) onChange(updated)
  }

  async function removeThreshold(channelId: string, ruleId: string) {
    const updated = await smartrekClient.deleteThreshold(sensor.id, channelId, ruleId)
    if (updated) onChange(updated)
  }

  async function addNotificationChannel() {
    const channel: NotificationChannel = { id: uid(), type: 'sms', target: '', enabled: true }
    const updated = await smartrekClient.upsertNotificationChannel(sensor.id, channel)
    if (updated) onChange(updated)
  }

  async function patchNotificationChannel(channel: NotificationChannel) {
    const updated = await smartrekClient.upsertNotificationChannel(sensor.id, channel)
    if (updated) onChange(updated)
  }

  async function removeNotificationChannel(id: string) {
    const updated = await smartrekClient.deleteNotificationChannel(sensor.id, id)
    if (updated) onChange(updated)
  }

  async function handleDelete() {
    await smartrekClient.deleteSensor(sensor.id)
    onDelete(sensor.id)
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg h-full bg-panel border-l border-line flex flex-col overflow-y-auto">
        <div className="p-5 border-b border-line flex items-start justify-between gap-3">
          <div className="flex-1">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              className="font-display font-semibold text-xl text-sap bg-transparent border-none outline-none w-full focus:ring-1 focus:ring-sap rounded px-1 -ml-1"
            />
            {sensor.serialNumber && (
              <p className="text-xs font-mono text-muted mt-0.5">{sensor.serialNumber}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <StatusBadge status={status} />
            {tempChannel && (
              <span className="font-mono text-sm tabular-nums">
                {tempChannel.currentValue}
                <span className="text-muted text-xs ml-0.5">{tempChannel.unit}</span>
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-muted hover:text-text text-xl leading-none px-1">
            ×
          </button>
        </div>

        <div className="p-5 flex flex-col gap-6">
          {/* Canaux de lecture — fixes de fabrication, non modifiables.
              La température est déjà affichée dans l'en-tête ci-dessus. */}
          <section className="flex flex-col gap-3">
            <h4 className="font-display text-sm tracking-wide text-muted uppercase">Canaux</h4>

            {sensor.channels
              .filter((c) => c.kind !== 'temperature')
              .map((channel) => {
              const alarming = isChannelAlarming(channel)
              return (
                <div key={channel.id} className="rounded-lg border border-line bg-panel-raised p-3 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="font-mono text-[10px] w-5 h-5 shrink-0 flex items-center justify-center rounded-full border border-line text-muted">
                        {CHANNEL_KIND_ABBR[channel.kind]}
                      </span>
                      <span className="text-sm font-medium">{channel.label}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className={`font-mono text-xl tabular-nums ${alarming ? 'text-danger' : ''}`}>
                        {channel.currentValue}
                      </span>
                      <span className="font-mono text-xs text-muted">{channel.unit}</span>
                    </div>
                  </div>

                  <Sparkline
                    data={channel.history}
                    color={alarming ? 'var(--color-danger)' : 'var(--color-sap)'}
                    width={440}
                    height={36}
                  />

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-muted uppercase">Seuils</span>
                      <button
                        onClick={() => addThreshold(channel.id, channel.currentValue)}
                        className="text-xs font-mono text-sap hover:underline"
                      >
                        + Ajouter
                      </button>
                    </div>
                    {channel.thresholds.length === 0 && (
                      <p className="text-xs text-muted italic">Aucun seuil configuré.</p>
                    )}
                    {channel.thresholds.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 text-xs">
                        <input
                          value={t.label}
                          onChange={(e) => patchThreshold(channel.id, { ...t, label: e.target.value })}
                          className="flex-1 bg-base border border-line rounded px-1.5 py-0.5 outline-none focus:border-sap"
                        />
                        <label className="flex items-center gap-1 font-mono text-muted">
                          Min
                          <input
                            type="number"
                            value={t.min ?? ''}
                            onChange={(e) =>
                              patchThreshold(channel.id, {
                                ...t,
                                min: e.target.value === '' ? undefined : Number(e.target.value),
                              })
                            }
                            className="w-14 bg-base border border-line rounded px-1 py-0.5 outline-none focus:border-sap"
                          />
                        </label>
                        <label className="flex items-center gap-1 font-mono text-muted">
                          Max
                          <input
                            type="number"
                            value={t.max ?? ''}
                            onChange={(e) =>
                              patchThreshold(channel.id, {
                                ...t,
                                max: e.target.value === '' ? undefined : Number(e.target.value),
                              })
                            }
                            className="w-14 bg-base border border-line rounded px-1 py-0.5 outline-none focus:border-sap"
                          />
                        </label>
                        <input
                          type="checkbox"
                          checked={t.enabled}
                          onChange={(e) => patchThreshold(channel.id, { ...t, enabled: e.target.checked })}
                          className="accent-sap"
                        />
                        <button
                          onClick={() => removeThreshold(channel.id, t.id)}
                          className="text-muted hover:text-danger px-1"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </section>

          {/* Notifications */}
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h4 className="font-display text-sm tracking-wide text-muted uppercase">Notifications</h4>
              <button onClick={addNotificationChannel} className="text-xs font-mono text-sap hover:underline">
                + Ajouter
              </button>
            </div>
            {sensor.notificationChannels.length === 0 && (
              <p className="text-sm text-muted italic">Aucune notification configurée.</p>
            )}
            {sensor.notificationChannels.map((c) => (
              <div key={c.id} className="rounded border border-line bg-panel-raised p-3 flex items-center gap-2">
                <select
                  value={c.type}
                  onChange={(e) =>
                    patchNotificationChannel({ ...c, type: e.target.value as NotificationChannel['type'] })
                  }
                  className="bg-base border border-line rounded px-1.5 py-1 text-xs font-mono outline-none"
                >
                  <option value="sms">SMS</option>
                  <option value="email">Courriel</option>
                  <option value="push">Push</option>
                </select>
                <input
                  value={c.target}
                  onChange={(e) => patchNotificationChannel({ ...c, target: e.target.value })}
                  placeholder={c.type === 'email' ? 'adresse@courriel.com' : 'Destinataire'}
                  className="flex-1 bg-transparent text-sm outline-none border-b border-transparent focus:border-line"
                />
                <label className="flex items-center gap-1.5 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={c.enabled}
                    onChange={(e) => patchNotificationChannel({ ...c, enabled: e.target.checked })}
                    className="accent-sap"
                  />
                </label>
                <button
                  onClick={() => removeNotificationChannel(c.id)}
                  className="text-muted hover:text-danger text-sm px-1"
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
