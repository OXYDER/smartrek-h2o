import type { Sensor, Site } from '../types/sensor'

function genHistory(base: number, spread: number, points = 24): { t: string; v: number }[] {
  const now = Date.now()
  return Array.from({ length: points }, (_, i) => {
    const t = new Date(now - (points - i) * 60 * 60 * 1000).toISOString()
    const v = Math.round((base + (Math.random() - 0.5) * spread) * 100) / 100
    return { t, v }
  })
}

export const mockSites: Site[] = [
  { id: 'site-ham-nord', name: 'Cabane', location: 'Ham-Nord, QC', sensorCount: 4 },
  { id: 'site-thetford', name: 'Thetford', location: 'Thetford Mines, QC', sensorCount: 1 },
]

export const mockSensors: Sensor[] = [
  {
    id: 'sn-123',
    name: '1-2-3',
    mac: '0.1.139.148',
    serialNumber: 'SKALP1KC-25270001N-4C8U',
    siteId: 'site-ham-nord',
    status: 'online',
    lastReadingAt: new Date().toISOString(),
    channels: [
      { id: 'ch-1', label: 'Vide 1', kind: 'vacuum', unit: 'inHg', currentValue: 21.82, history: genHistory(21.8, 0.6), thresholds: [{ id: 't1', label: 'Perte de vide', min: 20, enabled: true }] },
      { id: 'ch-2', label: 'Vide 2', kind: 'vacuum', unit: 'inHg', currentValue: 21.84, history: genHistory(21.8, 0.6), thresholds: [] },
      { id: 'ch-3', label: 'Vide 3', kind: 'vacuum', unit: 'inHg', currentValue: 21.76, history: genHistory(21.8, 0.6), thresholds: [] },
      { id: 'ch-4', label: 'Température', kind: 'temperature', unit: '°C', currentValue: -3.12, history: genHistory(-3, 1.5), thresholds: [{ id: 't2', label: 'Dégel', min: 0, enabled: true }] },
    ],
    notificationChannels: [{ id: 'a1', type: 'sms', target: '+1 819 555 0142', enabled: true }],
  },
  {
    id: 'sn-456',
    name: '4-5-6',
    mac: '0.1.139.146',
    serialNumber: 'SKALP1KC-25270001N-YQFB',
    siteId: 'site-ham-nord',
    status: 'online',
    lastReadingAt: new Date().toISOString(),
    channels: [
      { id: 'ch-1', label: 'Vide 1', kind: 'vacuum', unit: 'inHg', currentValue: 21.86, history: genHistory(21.85, 0.5), thresholds: [] },
      { id: 'ch-2', label: 'Vide 2', kind: 'vacuum', unit: 'inHg', currentValue: 21.81, history: genHistory(21.85, 0.5), thresholds: [] },
      { id: 'ch-3', label: 'Vide 3', kind: 'vacuum', unit: 'inHg', currentValue: 21.77, history: genHistory(21.85, 0.5), thresholds: [] },
      { id: 'ch-4', label: 'Température', kind: 'temperature', unit: '°C', currentValue: -2.37, history: genHistory(-2.5, 1.2), thresholds: [] },
    ],
    notificationChannels: [],
  },
  {
    id: 'sn-extracteur',
    name: 'Extracteur',
    mac: '0.1.135.248',
    serialNumber: 'SKALP1KC-25140001N-XUSG',
    siteId: 'site-ham-nord',
    status: 'warning',
    lastReadingAt: new Date().toISOString(),
    channels: [
      { id: 'ch-1', label: 'Vide', kind: 'vacuum', unit: 'inHg', currentValue: 19.4, history: genHistory(20, 2), thresholds: [{ id: 't3', label: 'Perte de vide', min: 20, enabled: true }] },
    ],
    notificationChannels: [{ id: 'a2', type: 'push', target: 'app-benoit', enabled: true }],
  },
  {
    id: 'sn-reservoir',
    name: 'Réservoir sève',
    siteId: 'site-ham-nord',
    status: 'online',
    lastReadingAt: new Date().toISOString(),
    channels: [
      { id: 'ch-1', label: 'Niveau', kind: 'level', unit: '%', currentValue: 62, history: genHistory(60, 15), thresholds: [{ id: 't4', label: 'Réservoir plein', max: 90, enabled: true }] },
      { id: 'ch-2', label: 'Débit', kind: 'flow', unit: 'L/min', currentValue: 8.4, history: genHistory(8, 3), thresholds: [] },
    ],
    notificationChannels: [],
  },
  {
    id: 'sn-chaudiere',
    name: 'Chaudière',
    siteId: 'site-thetford',
    status: 'alarm',
    lastReadingAt: new Date().toISOString(),
    channels: [
      { id: 'ch-1', label: 'Pression', kind: 'pressure', unit: 'kPa', currentValue: 158, history: genHistory(150, 15), thresholds: [{ id: 't5', label: 'Surpression', max: 155, enabled: true }] },
    ],
    notificationChannels: [{ id: 'a3', type: 'sms', target: '+1 418 555 0199', enabled: true }],
  },
]
