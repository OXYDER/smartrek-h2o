import { useState } from 'react'
import type { Sensor, SensorChannel } from '../types/sensor'
import { getChannelDifferential, isChannelDifferentialAlarming, withUpdatedDifferential } from '../lib/differential'
import { smartrekClient } from '../api/client'

interface Props {
  sensors: Sensor[]
  onOpenSensor: (id: string) => void
  onSensorChange: (sensor: Sensor) => void
}

interface DiffEntry {
  sensor: Sensor
  channel: SensorChannel
  diff: number
  refSensor?: Sensor
  refChannel?: SensorChannel
}

export function DifferentialsPage({ sensors, onOpenSensor, onSensorChange }: Props) {
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null)
  const [draftLabel, setDraftLabel] = useState('')

  const entries: DiffEntry[] = []
  for (const sensor of sensors) {
    for (const channel of sensor.channels) {
      if (!channel.differential) continue
      const diff = getChannelDifferential(channel, sensors)
      if (diff === undefined) continue
      const refSensor = sensors.find((s) => s.id === channel.differential!.referenceSensorId)
      const refChannel = refSensor?.channels.find((c) => c.id === channel.differential!.referencePortId)
      entries.push({ sensor, channel, diff, refSensor, refChannel })
    }
  }
  entries.sort((a, b) => b.diff - a.diff)

  async function saveLabel(sensor: Sensor, channel: SensorChannel) {
    const newChannels = withUpdatedDifferential(sensor, channel.id, { ...channel.differential!, label: draftLabel })
    const updated = await smartrekClient.updateSensor(sensor.id, { channels: newChannels })
    if (updated) onSensorChange(updated)
    setEditingChannelId(null)
  }

  async function removeDifferential(sensor: Sensor, channel: SensorChannel) {
    const newChannels = withUpdatedDifferential(sensor, channel.id, undefined)
    const updated = await smartrekClient.updateSensor(sensor.id, { channels: newChannels })
    if (updated) onSensorChange(updated)
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="font-display text-lg text-muted">Aucun différentiel configuré.</p>
        <p className="text-sm text-muted mt-1">
          Configure-en un depuis le détail d'un capteur, sur n'importe quel port de vide.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-line overflow-hidden overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-panel-raised border-b border-line">
            <th className="px-3 py-2 text-left font-mono text-[11px] uppercase tracking-wide text-muted">Nom</th>
            <th className="px-3 py-2 text-left font-mono text-[11px] uppercase tracking-wide text-muted whitespace-nowrap">
              Capteur · Port
            </th>
            <th className="px-3 py-2 text-left font-mono text-[11px] uppercase tracking-wide text-muted whitespace-nowrap">
              Référence
            </th>
            <th className="px-3 py-2 text-left font-mono text-[11px] uppercase tracking-wide text-muted">Écart</th>
            <th className="px-3 py-2 w-8"></th>
          </tr>
        </thead>
        <tbody>
          {entries.map(({ sensor, channel, diff, refSensor, refChannel }, i) => {
            const alarming = isChannelDifferentialAlarming(channel, sensors)
            const isEditing = editingChannelId === channel.id
            return (
              <tr key={channel.id} className={`border-b border-line ${i % 2 === 0 ? 'bg-panel' : 'bg-panel/60'}`}>
                <td className="px-3 py-2 min-w-[140px]">
                  {isEditing ? (
                    <input
                      autoFocus
                      value={draftLabel}
                      onChange={(e) => setDraftLabel(e.target.value)}
                      onBlur={() => saveLabel(sensor, channel)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveLabel(sensor, channel)
                        if (e.key === 'Escape') setEditingChannelId(null)
                      }}
                      placeholder="Nom du différentiel"
                      className="bg-base border border-sap rounded px-1.5 py-0.5 text-sm outline-none w-full"
                    />
                  ) : (
                    <button
                      onClick={() => {
                        setEditingChannelId(channel.id)
                        setDraftLabel(channel.differential?.label ?? '')
                      }}
                      className="text-left hover:text-sap w-full truncate"
                      title="Renommer"
                    >
                      {channel.differential?.label || (
                        <span className="text-muted italic">Sans nom · cliquer pour nommer</span>
                      )}
                    </button>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <button onClick={() => onOpenSensor(sensor.id)} className="text-sap hover:underline">
                    {sensor.name}
                  </button>
                  <span className="text-muted"> · {channel.label}</span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-muted">
                  {refSensor ? (
                    <button onClick={() => onOpenSensor(refSensor.id)} className="text-sap hover:underline">
                      {refSensor.name}
                    </button>
                  ) : (
                    '?'
                  )}
                  {refChannel && <span> · {refChannel.label}</span>}
                </td>
                <td className={`px-3 py-2 font-mono tabular-nums ${alarming ? 'text-danger' : ''}`}>
                  {diff > 0 ? '+' : ''}
                  {diff}
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => removeDifferential(sensor, channel)}
                    className="text-muted hover:text-danger text-xs"
                    title="Retirer ce différentiel"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
