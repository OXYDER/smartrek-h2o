import { useState } from 'react'
import type { PortDifferentialConfig, Sensor, SensorChannel, ThresholdRule } from '../types/sensor'
import { CHANNEL_KIND_ABBR } from '../types/sensor'
import { StatusBadge } from './StatusBadge'
import { BatteryIndicator } from './BatteryIndicator'
import { DeviceIcon } from './DeviceIcon'
import { Sparkline } from './Sparkline'
import { smartrekClient } from '../api/client'
import { getEffectiveStatus, isChannelAlarming } from '../lib/sensorStatus'
import { getSensorIconKind } from '../lib/sensorType'
import { getChannelDifferential, isChannelDifferentialAlarming } from '../lib/differential'

interface Props {
  sensor: Sensor
  allSensors: Sensor[]
  onClose: () => void
  onChange: (sensor: Sensor) => void
  onDelete: (id: string) => void
  /** Rend le contenu sans le voile/overlay plein écran — pour l'afficher
   * dans le flux normal de la page (ex. sous une carte) plutôt qu'en
   * fenêtre modale par-dessus tout. */
  inline?: boolean
}

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

export function SensorDetailPanel({ sensor, allSensors, onClose, onChange, onDelete, inline = false }: Props) {
  const [name, setName] = useState(sensor.name)
  const [notes, setNotes] = useState(sensor.notes ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [expandedDiffChannelId, setExpandedDiffChannelId] = useState<string | null>(null)

  const status = getEffectiveStatus(sensor, allSensors)
  const tempChannel = sensor.channels.find((c) => c.kind === 'temperature')

  // Liste plate de tous les ports de vide de TOUS les autres capteurs —
  // choix direct du port de référence en une seule étape.
  const referencePortOptions = allSensors
    .filter((s) => s.id !== sensor.id)
    .flatMap((s) => s.channels.filter((c) => c.kind === 'vacuum').map((c) => ({ sensor: s, channel: c })))

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

  async function addAlarm(channelId: string, currentValue: number) {
    const rule: ThresholdRule = { id: uid(), label: 'Nouvelle alarme', max: currentValue + 5, enabled: true }
    const updated = await smartrekClient.upsertThreshold(sensor.id, channelId, rule)
    if (updated) onChange(updated)
  }

  async function patchAlarm(channelId: string, rule: ThresholdRule) {
    const updated = await smartrekClient.upsertThreshold(sensor.id, channelId, rule)
    if (updated) onChange(updated)
  }

  async function removeAlarm(channelId: string, ruleId: string) {
    const updated = await smartrekClient.deleteThreshold(sensor.id, channelId, ruleId)
    if (updated) onChange(updated)
  }

  // Le différentiel vit sur le canal lui-même — on patche le tableau
  // `channels` en entier via updateSensor (pas d'endpoint dédié par canal).
  async function patchChannelDifferential(channelId: string, config: PortDifferentialConfig | undefined) {
    const newChannels: SensorChannel[] = sensor.channels.map((c) =>
      c.id === channelId ? { ...c, differential: config } : c
    )
    const updated = await smartrekClient.updateSensor(sensor.id, { channels: newChannels })
    if (updated) onChange(updated)
  }

  async function handleDelete() {
    await smartrekClient.deleteSensor(sensor.id)
    onDelete(sensor.id)
  }

  const panelContent = (
    <div
      className={
        inline
          ? 'relative w-full h-full bg-panel border-r border-line flex flex-col overflow-y-auto'
          : 'relative w-full max-w-lg h-full bg-panel border-l border-line flex flex-col overflow-y-auto'
      }
    >
      <div className="p-5 border-b border-line flex items-start justify-between gap-3">
          <div className="flex-1 flex items-start gap-2 min-w-0">
            <DeviceIcon kind={getSensorIconKind(sensor)} size={26} color="var(--color-sap)" className="mt-1" />
            <div className="flex-1 min-w-0">
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
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <StatusBadge status={status} />
            <div className="flex items-center gap-2">
              {sensor.batteryPercent !== undefined && <BatteryIndicator percent={sensor.batteryPercent} />}
              {tempChannel && (
                <span className="font-mono text-sm tabular-nums">
                  {tempChannel.currentValue}
                  <span className="text-muted text-xs ml-0.5">{tempChannel.unit}</span>
                </span>
              )}
            </div>
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

            {sensor.channels.length === 0 && (
              <p className="text-sm text-muted italic">
                {sensor.deviceType === 1
                  ? "Aucune donnée récente disponible — ce capteur de niveau ne transmet que sa configuration de calibration, pas de lecture en direct dans les données reçues."
                  : sensor.deviceType === 2
                    ? 'Contrôle à distance (2 canaux relais) — état des canaux pas encore décodé.'
                    : sensor.deviceType === 10
                      ? 'Répéteur réseau — pas un capteur de mesure.'
                      : "Lecture pas encore décodée pour ce type d'appareil."}
              </p>
            )}

            {sensor.channels
              .filter((c) => c.kind !== 'temperature')
              .map((channel) => {
                const alarming = isChannelAlarming(channel)
                const diff = getChannelDifferential(channel, allSensors)
                const diffAlarming = isChannelDifferentialAlarming(channel, allSensors)
                const diffExpanded = expandedDiffChannelId === channel.id
                const refSensor = channel.differential
                  ? allSensors.find((s) => s.id === channel.differential!.referenceSensorId)
                  : undefined
                const refChannel = refSensor?.channels.find((c) => c.id === channel.differential?.referencePortId)

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
                        <span className={`font-mono text-xl tabular-nums ${alarming || diffAlarming ? 'text-danger' : ''}`}>
                          {channel.currentValue}
                        </span>
                        <span className="font-mono text-xs text-muted">{channel.unit}</span>
                        {diff !== undefined && (
                          <span className={`font-mono text-xs ${diffAlarming ? 'text-danger' : 'text-muted'}`}>
                            ({diff > 0 ? '+' : ''}
                            {diff})
                          </span>
                        )}
                      </div>
                    </div>

                    <Sparkline
                      data={channel.history}
                      color={alarming || diffAlarming ? 'var(--color-danger)' : 'var(--color-sap)'}
                      width={440}
                      height={36}
                    />

                    {/* Alarmes — seuil + notification fusionnés */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-muted uppercase">Alarmes</span>
                        <button
                          onClick={() => addAlarm(channel.id, channel.currentValue)}
                          className="text-xs font-mono text-sap hover:underline"
                        >
                          + Alarme
                        </button>
                      </div>
                      {channel.thresholds.length === 0 && (
                        <p className="text-xs text-muted italic">Aucune alarme configurée.</p>
                      )}
                      {channel.thresholds.map((t) => (
                        <div key={t.id} className="rounded border border-line bg-base p-2 flex flex-col gap-1.5">
                          <div className="flex items-center gap-2 text-xs">
                            <input
                              value={t.label}
                              onChange={(e) => patchAlarm(channel.id, { ...t, label: e.target.value })}
                              className="flex-1 bg-transparent border-b border-transparent focus:border-line outline-none"
                            />
                            <label className="flex items-center gap-1 font-mono text-muted">
                              Min
                              <input
                                type="number"
                                value={t.min ?? ''}
                                onChange={(e) =>
                                  patchAlarm(channel.id, {
                                    ...t,
                                    min: e.target.value === '' ? undefined : Number(e.target.value),
                                  })
                                }
                                className="w-14 bg-panel-raised border border-line rounded px-1 py-0.5 outline-none focus:border-sap"
                              />
                            </label>
                            <label className="flex items-center gap-1 font-mono text-muted">
                              Max
                              <input
                                type="number"
                                value={t.max ?? ''}
                                onChange={(e) =>
                                  patchAlarm(channel.id, {
                                    ...t,
                                    max: e.target.value === '' ? undefined : Number(e.target.value),
                                  })
                                }
                                className="w-14 bg-panel-raised border border-line rounded px-1 py-0.5 outline-none focus:border-sap"
                              />
                            </label>
                            <input
                              type="checkbox"
                              checked={t.enabled}
                              onChange={(e) => patchAlarm(channel.id, { ...t, enabled: e.target.checked })}
                              className="accent-sap"
                              title="Alarme active"
                            />
                            <button
                              onClick={() => removeAlarm(channel.id, t.id)}
                              className="text-muted hover:text-danger px-1"
                            >
                              ✕
                            </button>
                          </div>

                          <div className="flex items-center gap-2 text-xs pt-1.5 border-t border-line">
                            <span className="text-muted font-mono uppercase text-[10px] shrink-0">Notifier</span>
                            <select
                              value={t.notification?.type ?? 'sms'}
                              onChange={(e) =>
                                patchAlarm(channel.id, {
                                  ...t,
                                  notification: {
                                    type: e.target.value as 'sms' | 'email' | 'push',
                                    target: t.notification?.target ?? '',
                                    enabled: t.notification?.enabled ?? true,
                                  },
                                })
                              }
                              className="bg-panel-raised border border-line rounded px-1.5 py-1 font-mono outline-none"
                            >
                              <option value="sms">SMS</option>
                              <option value="email">Courriel</option>
                              <option value="push">Push</option>
                            </select>
                            <input
                              value={t.notification?.target ?? ''}
                              onChange={(e) =>
                                patchAlarm(channel.id, {
                                  ...t,
                                  notification: {
                                    type: t.notification?.type ?? 'sms',
                                    target: e.target.value,
                                    enabled: t.notification?.enabled ?? true,
                                  },
                                })
                              }
                              placeholder={t.notification?.type === 'email' ? 'adresse@courriel.com' : 'Destinataire'}
                              className="flex-1 bg-transparent border-b border-transparent focus:border-line outline-none min-w-0"
                            />
                            {t.notification && (
                              <input
                                type="checkbox"
                                checked={t.notification.enabled}
                                onChange={(e) =>
                                  patchAlarm(channel.id, {
                                    ...t,
                                    notification: { ...t.notification!, enabled: e.target.checked },
                                  })
                                }
                                className="accent-sap"
                                title="Notification active"
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Différentiel — seulement pertinent pour les canaux de vide */}
                    {channel.kind === 'vacuum' && (
                      <div className="flex flex-col gap-1.5 pt-1.5 border-t border-line">
                        {!channel.differential ? (
                          <button
                            onClick={() => setExpandedDiffChannelId(diffExpanded ? null : channel.id)}
                            className="text-xs font-mono text-sap hover:underline text-left"
                          >
                            + Différentiel
                          </button>
                        ) : (
                          <button
                            onClick={() => setExpandedDiffChannelId(diffExpanded ? null : channel.id)}
                            className="text-xs font-mono text-sap hover:underline text-left"
                          >
                            {diffExpanded ? '▾' : '▸'} Différentiel
                            <span className="text-muted">
                              {' '}
                              (vs {refSensor?.name ?? '?'} · {refChannel?.label ?? '?'})
                            </span>
                          </button>
                        )}

                        {diffExpanded && (
                          <div className="flex flex-col gap-2 pl-1">
                            <label className="flex flex-col gap-1 text-xs">
                              <span className="text-muted font-mono uppercase">Nom du différentiel</span>
                              <input
                                value={channel.differential?.label ?? ''}
                                onChange={(e) => {
                                  if (!channel.differential) return
                                  patchChannelDifferential(channel.id, { ...channel.differential, label: e.target.value })
                                }}
                                placeholder="Ex. Ligne principale vs station"
                                disabled={!channel.differential}
                                className="bg-base border border-line rounded px-2 py-1 text-sm outline-none focus:border-sap disabled:opacity-40"
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-xs">
                              <span className="text-muted font-mono uppercase">Port de référence</span>
                              <select
                                value={
                                  channel.differential
                                    ? `${channel.differential.referenceSensorId}::${channel.differential.referencePortId}`
                                    : ''
                                }
                                onChange={(e) => {
                                  if (!e.target.value) {
                                    patchChannelDifferential(channel.id, undefined)
                                    return
                                  }
                                  const [refSensorId, refPortId] = e.target.value.split('::')
                                  patchChannelDifferential(channel.id, {
                                    label: channel.differential?.label,
                                    referenceSensorId: refSensorId,
                                    referencePortId: refPortId,
                                    threshold: channel.differential?.threshold,
                                  })
                                }}
                                className="bg-base border border-line rounded px-2 py-1 text-sm outline-none focus:border-sap"
                              >
                                <option value="">Aucun</option>
                                {referencePortOptions.map(({ sensor: s, channel: c }) => (
                                  <option key={`${s.id}::${c.id}`} value={`${s.id}::${c.id}`}>
                                    {s.name} — {c.label} ({c.currentValue} {c.unit})
                                  </option>
                                ))}
                              </select>
                            </label>

                            {channel.differential?.referencePortId && (
                              <div className="flex flex-col gap-1.5 pt-1 border-t border-line">
                                <span className="text-xs font-mono text-muted uppercase">Alarme sur l'écart</span>
                                {channel.differential.threshold ? (
                                  <div className="flex items-center gap-2 text-xs">
                                    <label className="flex items-center gap-1 font-mono text-muted">
                                      Min
                                      <input
                                        type="number"
                                        value={channel.differential.threshold.min ?? ''}
                                        onChange={(e) =>
                                          patchChannelDifferential(channel.id, {
                                            ...channel.differential!,
                                            threshold: {
                                              ...channel.differential!.threshold!,
                                              min: e.target.value === '' ? undefined : Number(e.target.value),
                                            },
                                          })
                                        }
                                        className="w-14 bg-base border border-line rounded px-1 py-0.5 outline-none focus:border-sap"
                                      />
                                    </label>
                                    <label className="flex items-center gap-1 font-mono text-muted">
                                      Max
                                      <input
                                        type="number"
                                        value={channel.differential.threshold.max ?? ''}
                                        onChange={(e) =>
                                          patchChannelDifferential(channel.id, {
                                            ...channel.differential!,
                                            threshold: {
                                              ...channel.differential!.threshold!,
                                              max: e.target.value === '' ? undefined : Number(e.target.value),
                                            },
                                          })
                                        }
                                        className="w-14 bg-base border border-line rounded px-1 py-0.5 outline-none focus:border-sap"
                                      />
                                    </label>
                                    <input
                                      type="checkbox"
                                      checked={channel.differential.threshold.enabled}
                                      onChange={(e) =>
                                        patchChannelDifferential(channel.id, {
                                          ...channel.differential!,
                                          threshold: { ...channel.differential!.threshold!, enabled: e.target.checked },
                                        })
                                      }
                                      className="accent-sap"
                                    />
                                    <button
                                      onClick={() =>
                                        patchChannelDifferential(channel.id, {
                                          ...channel.differential!,
                                          threshold: undefined,
                                        })
                                      }
                                      className="text-muted hover:text-danger px-1"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() =>
                                      patchChannelDifferential(channel.id, {
                                        ...channel.differential!,
                                        threshold: { id: uid(), label: 'Écart trop grand', max: 5, enabled: true },
                                      })
                                    }
                                    className="text-xs font-mono text-sap hover:underline text-left"
                                  >
                                    + Configurer une alarme
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
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
  )

  if (inline) return panelContent

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      {panelContent}
    </div>
  )
}
