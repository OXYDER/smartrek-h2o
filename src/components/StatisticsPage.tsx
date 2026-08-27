import { useState } from 'react'
import type { Sensor } from '../types/sensor'
import { getEffectiveStatus } from '../lib/sensorStatus'
import { HistoryChart } from './HistoryChart'
import { VacuumLeakStats } from './VacuumLeakStats'

interface Props {
  sensors: Sensor[]
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-4 flex flex-col gap-1">
      <span className="text-xs font-mono text-muted uppercase tracking-wide">{label}</span>
      <span className="font-display text-2xl font-semibold" style={color ? { color } : undefined}>
        {value}
      </span>
    </div>
  )
}

export function StatisticsPage({ sensors }: Props) {
  const [selectedSensorId, setSelectedSensorId] = useState<string>('')
  const [selectedChannelId, setSelectedChannelId] = useState<string>('')

  const total = sensors.length
  const statuses = sensors.map((s) => getEffectiveStatus(s, sensors))
  const online = statuses.filter((s) => s === 'online').length
  const offline = statuses.filter((s) => s === 'offline').length
  const alarm = statuses.filter((s) => s === 'alarm').length
  const withBattery = sensors.filter((s) => s.batteryPercent !== undefined)
  const avgBattery =
    withBattery.length > 0
      ? Math.round(withBattery.reduce((sum, s) => sum + (s.batteryPercent ?? 0), 0) / withBattery.length)
      : null

  const selectedSensor = sensors.find((s) => s.id === selectedSensorId)
  const selectedChannel = selectedSensor?.channels.find((c) => c.id === selectedChannelId)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="font-display text-sm tracking-wide text-muted uppercase mb-2">En direct</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard label="Capteurs" value={total} />
          <StatCard label="En ligne" value={online} color="var(--color-lime)" />
          <StatCard label="Hors ligne" value={offline} color="var(--color-danger)" />
          <StatCard label="Alarmes" value={alarm} color="var(--color-danger)" />
          <StatCard label="Batterie moy." value={avgBattery !== null ? `${avgBattery}%` : '—'} />
        </div>
      </div>

      <VacuumLeakStats sensors={sensors} />

      <div className="flex flex-col gap-3">
        <h3 className="font-display text-sm tracking-wide text-muted uppercase">Historique par canal</h3>

        <div className="flex flex-wrap gap-2">
          <select
            value={selectedSensorId}
            onChange={(e) => {
              setSelectedSensorId(e.target.value)
              setSelectedChannelId('')
            }}
            className="bg-panel border border-line rounded px-2 py-1.5 text-sm outline-none focus:border-sap"
          >
            <option value="">Choisir un capteur…</option>
            {sensors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {selectedSensor && (
            <select
              value={selectedChannelId}
              onChange={(e) => setSelectedChannelId(e.target.value)}
              className="bg-panel border border-line rounded px-2 py-1.5 text-sm outline-none focus:border-sap"
            >
              <option value="">Choisir un canal…</option>
              {selectedSensor.channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} ({c.currentValue} {c.unit})
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedChannel ? (
          <div className="rounded-lg border border-line bg-panel p-4">
            <HistoryChart channelId={selectedChannel.id} unit={selectedChannel.unit} />
          </div>
        ) : (
          <p className="text-sm text-muted italic">Choisis un capteur puis un canal pour voir son historique.</p>
        )}
      </div>
    </div>
  )
}
