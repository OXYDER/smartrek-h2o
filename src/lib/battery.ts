/** Dégradé rouge → orange → vert selon le pourcentage (0-100). */
export function getBatteryColor(percent: number): string {
  const clamped = Math.max(0, Math.min(100, percent))
  const hue = (clamped / 100) * 120 // 0 = rouge, 120 = vert
  return `hsl(${hue}, 75%, 50%)`
}
