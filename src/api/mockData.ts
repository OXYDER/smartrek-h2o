import type { Sensor, Site } from '../types/sensor'

function genHistory(base: number, spread: number, points = 24): { t: string; v: number }[] {
  const now = Date.now()
  return Array.from({ length: points }, (_, i) => {
    const t = new Date(now - (points - i) * 60 * 60 * 1000).toISOString()
    const v = Math.round((base + (Math.random() - 0.5) * spread) * 10) / 10
    return { t, v }
  })
}

export const mockSites: Site[] = [
  { id: 'site-ham-nord', name: 'Érablière Ham-Nord', location: 'Ham-Nord, QC', sensorCount: 5 },
  { id: 'site-thetford', name: 'Érablière Thetford', location: 'Thetford Mines, QC', sensorCount: 2 },
]

export const mockSensors: Sensor[] = [
  {
    id: 'sn-001',
    name: 'Évaporateur — Sonde principale',
    kind: 'temperature',
    siteId: 'site-ham-nord',
    unit: '°C',
    currentValue: 104.2,
    status: 'online',
    lastReadingAt: new Date().toISOString(),
    history: genHistory(104, 3),
    thresholds: [
      { id: 't1', label: 'Surchauffe', max: 108, enabled: true },
      { id: 't2', label: 'Sous-température', min: 98, enabled: true },
    ],
    alertChannels: [
      { id: 'a1', type: 'sms', target: '+1 819 555 0142', enabled: true },
    ],
  },
  {
    id: 'sn-002',
    name: 'Ligne principale — Vide',
    kind: 'vacuum',
    siteId: 'site-ham-nord',
    unit: 'inHg',
    currentValue: 24.8,
    status: 'online',
    lastReadingAt: new Date().toISOString(),
    history: genHistory(25, 1.5),
    thresholds: [{ id: 't3', label: 'Perte de vide', min: 22, enabled: true }],
    alertChannels: [{ id: 'a2', type: 'push', target: 'app-benoit', enabled: true }],
  },
  {
    id: 'sn-003',
    name: 'Réservoir sève — Niveau',
    kind: 'level',
    siteId: 'site-ham-nord',
    unit: '%',
    currentValue: 87,
    status: 'warning',
    lastReadingAt: new Date().toISOString(),
    history: genHistory(80, 20),
    thresholds: [{ id: 't4', label: 'Réservoir plein', max: 90, enabled: true }],
    alertChannels: [
      { id: 'a3', type: 'sms', target: '+1 819 555 0142', enabled: true },
      { id: 'a4', type: 'email', target: 'benoit@resotik.ca', enabled: false },
    ],
  },
  {
    id: 'sn-004',
    name: 'Débit sève — Collecteur nord',
    kind: 'flow',
    siteId: 'site-ham-nord',
    unit: 'L/min',
    currentValue: 12.4,
    status: 'online',
    lastReadingAt: new Date().toISOString(),
    history: genHistory(12, 5),
    thresholds: [],
    alertChannels: [],
  },
  {
    id: 'sn-005',
    name: 'Bâtiment — Humidité',
    kind: 'humidity',
    siteId: 'site-ham-nord',
    unit: '%',
    currentValue: 61,
    status: 'offline',
    lastReadingAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    history: genHistory(58, 10),
    thresholds: [{ id: 't5', label: 'Humidité excessive', max: 75, enabled: false }],
    alertChannels: [],
  },
  {
    id: 'sn-006',
    name: 'Chaudière — Pression',
    kind: 'pressure',
    siteId: 'site-thetford',
    unit: 'kPa',
    currentValue: 152,
    status: 'alarm',
    lastReadingAt: new Date().toISOString(),
    history: genHistory(150, 15),
    thresholds: [{ id: 't6', label: 'Surpression', max: 160, enabled: true }],
    alertChannels: [{ id: 'a5', type: 'sms', target: '+1 418 555 0199', enabled: true }],
  },
  {
    id: 'sn-007',
    name: 'Ligne secondaire — Vide',
    kind: 'vacuum',
    siteId: 'site-thetford',
    unit: 'inHg',
    currentValue: 23.9,
    status: 'online',
    lastReadingAt: new Date().toISOString(),
    history: genHistory(24, 1),
    thresholds: [],
    alertChannels: [],
  },
]
