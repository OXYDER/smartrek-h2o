import { useEffect, useState } from 'react'
import type { Sensor } from '../types/sensor'
import { statsClient, type LeakByHour, type LeakByLine, type LeakDayNight, type LeakTimelinePoint } from '../api/overlayClient'

interface Props {
  sensors: Sensor[]
}

const PERIOD_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: '24 heures' },
  { value: 7, label: '7 jours' },
  { value: 30, label: '30 jours' },
]

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${Math.round(totalSeconds)} s`
  const minutes = totalSeconds / 60
  if (minutes < 60) return `${Math.round(minutes)} min`
  const hours = minutes / 60
  if (hours < 24) return `${hours.toFixed(1)} h`
  return `${(hours / 24).toFixed(1)} j`
}

function sensorName(sensors: Sensor[], id: string): string {
  return sensors.find((s) => s.id === id)?.name ?? id
}

export function VacuumLeakStats({ sensors }: Props) {
  const [days, setDays] = useState(7)
  const [bucket, setBucket] = useState<'minute' | 'hour' | 'day'>('hour')
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<{ leak_count: number; total_seconds: number; ongoing_count: number } | null>(
    null
  )
  const [byHour, setByHour] = useState<LeakByHour[]>([])
  const [byLine, setByLine] = useState<LeakByLine[]>([])
  const [dayNight, setDayNight] = useState<LeakDayNight[]>([])
  const [timeline, setTimeline] = useState<LeakTimelinePoint[]>([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      statsClient.summary(days),
      statsClient.byHourOfDay(days),
      statsClient.byLine(days),
      statsClient.dayNight(days),
      statsClient.timeline(days, bucket),
    ]).then(([s, h, l, dn, tl]) => {
      if (cancelled) return
      setSummary(s)
      setByHour(h ?? [])
      setByLine(l ?? [])
      setDayNight(dn ?? [])
      setTimeline(tl ?? [])
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [days, bucket])

  const maxHourCount = Math.max(1, ...byHour.map((h) => h.leak_count))
  const maxLineCount = Math.max(1, ...byLine.map((l) => l.leak_count))
  const jour = dayNight.find((d) => d.period === 'jour')
  const nuit = dayNight.find((d) => d.period === 'nuit')
  const maxDayNight = Math.max(1, jour?.leak_count ?? 0, nuit?.leak_count ?? 0)
  const criticalHour = byHour.length > 0 ? byHour.reduce((a, b) => (b.leak_count > a.leak_count ? b : a)) : null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-display text-sm tracking-wide text-muted uppercase">Fuites de vide (capteurs vacuum)</h3>
        <div className="flex gap-1">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={`text-xs font-mono px-2.5 py-1 rounded-full border transition-colors ${
                days === opt.value ? 'border-sap text-sap bg-sap/10' : 'border-line text-muted hover:text-text'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted italic -mt-2">
        Basé sur les seuils configurés sur chaque port — une « fuite » est un épisode continu où la lecture dépasse
        son seuil, pas juste un point isolé. L'historique commence à s'accumuler depuis l'ajout de cette
        fonctionnalité, donc les périodes plus longues peuvent avoir moins de données.
      </p>

      {loading ? (
        <p className="text-sm text-muted font-mono">Calcul en cours…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border border-line bg-panel p-4 flex flex-col gap-1">
              <span className="text-xs font-mono text-muted uppercase">Nombre de fuites</span>
              <span className="font-display text-2xl font-semibold">{summary?.leak_count ?? 0}</span>
            </div>
            <div className="rounded-lg border border-line bg-panel p-4 flex flex-col gap-1">
              <span className="text-xs font-mono text-muted uppercase">Durée totale</span>
              <span className="font-display text-2xl font-semibold">
                {formatDuration(summary?.total_seconds ?? 0)}
              </span>
            </div>
            <div className="rounded-lg border border-line bg-panel p-4 flex flex-col gap-1">
              <span className="text-xs font-mono text-muted uppercase">En cours</span>
              <span
                className="font-display text-2xl font-semibold"
                style={{ color: (summary?.ongoing_count ?? 0) > 0 ? 'var(--color-danger)' : undefined }}
              >
                {summary?.ongoing_count ?? 0}
              </span>
            </div>
            <div className="rounded-lg border border-line bg-panel p-4 flex flex-col gap-1">
              <span className="text-xs font-mono text-muted uppercase">Heure critique</span>
              <span className="font-display text-2xl font-semibold">
                {criticalHour ? `${criticalHour.hour}h` : '—'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-line bg-panel p-4 flex flex-col gap-2">
              <h4 className="text-xs font-mono text-muted uppercase">Fuites par heure du jour</h4>
              {byHour.length === 0 ? (
                <p className="text-sm text-muted italic">Aucune fuite enregistrée sur cette période.</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {byHour.map((h) => (
                    <div key={h.hour} className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-muted w-8 shrink-0">{h.hour}h</span>
                      <div className="flex-1 h-4 bg-base rounded overflow-hidden">
                        <div
                          className="h-full rounded"
                          style={{
                            width: `${(h.leak_count / maxHourCount) * 100}%`,
                            backgroundColor: 'var(--color-danger)',
                          }}
                        />
                      </div>
                      <span className="font-mono text-muted w-6 text-right shrink-0">{h.leak_count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-line bg-panel p-4 flex flex-col gap-2">
              <h4 className="text-xs font-mono text-muted uppercase">Jour (6h-19h) vs Nuit (20h-5h)</h4>
              {!jour && !nuit ? (
                <p className="text-sm text-muted italic">Aucune fuite enregistrée sur cette période.</p>
              ) : (
                <div className="flex flex-col gap-2 mt-1">
                  {[
                    { label: '☀ Jour', data: jour },
                    { label: '☾ Nuit', data: nuit },
                  ].map(({ label, data }) => (
                    <div key={label} className="flex items-center gap-2 text-sm">
                      <span className="w-16 shrink-0">{label}</span>
                      <div className="flex-1 h-5 bg-base rounded overflow-hidden">
                        <div
                          className="h-full rounded bg-sap"
                          style={{ width: `${((data?.leak_count ?? 0) / maxDayNight) * 100}%` }}
                        />
                      </div>
                      <span className="font-mono text-muted w-24 text-right shrink-0">
                        {data?.leak_count ?? 0} · {formatDuration(data?.total_seconds ?? 0)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-line bg-panel p-4 flex flex-col gap-2">
            <h4 className="text-xs font-mono text-muted uppercase">Lignes les plus problématiques</h4>
            {byLine.length === 0 ? (
              <p className="text-sm text-muted italic">Aucune fuite enregistrée sur cette période.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {byLine.map((l) => (
                  <div key={l.sensor_id} className="flex items-center gap-2 text-xs">
                    <span className="w-32 truncate shrink-0">{sensorName(sensors, l.sensor_id)}</span>
                    <div className="flex-1 h-4 bg-base rounded overflow-hidden">
                      <div
                        className="h-full rounded"
                        style={{
                          width: `${(l.leak_count / maxLineCount) * 100}%`,
                          backgroundColor: 'var(--color-syrup)',
                        }}
                      />
                    </div>
                    <span className="font-mono text-muted w-28 text-right shrink-0">
                      {l.leak_count} · {formatDuration(l.total_seconds)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-line bg-panel p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono text-muted uppercase">Chronologie</h4>
              <div className="flex gap-1">
                {(['minute', 'hour', 'day'] as const).map((b) => (
                  <button
                    key={b}
                    onClick={() => setBucket(b)}
                    className={`text-xs font-mono px-2 py-0.5 rounded-full border transition-colors ${
                      bucket === b ? 'border-sap text-sap bg-sap/10' : 'border-line text-muted hover:text-text'
                    }`}
                  >
                    {b === 'minute' ? 'Minute' : b === 'hour' ? 'Heure' : 'Jour'}
                  </button>
                ))}
              </div>
            </div>
            {timeline.length === 0 ? (
              <p className="text-sm text-muted italic">Aucune fuite enregistrée sur cette période.</p>
            ) : (
              <div className="flex items-end gap-0.5 h-24">
                {timeline.map((pt, i) => {
                  const max = Math.max(1, ...timeline.map((p) => p.leakCount))
                  return (
                    <div
                      key={i}
                      className="flex-1 bg-danger rounded-t min-w-[2px]"
                      style={{ height: `${(pt.leakCount / max) * 100}%`, opacity: 0.4 + 0.6 * (pt.leakCount / max) }}
                      title={`${new Date(pt.t).toLocaleString('fr-CA')} — ${pt.leakCount} fuite${pt.leakCount !== 1 ? 's' : ''}`}
                    />
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
