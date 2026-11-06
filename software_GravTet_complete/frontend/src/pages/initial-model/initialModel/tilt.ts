/**
 * Initial-model gravity helpers: `tilt.ts`.
 */

export function tiltToDeclInc(tiltX: number, tiltY: number) {
  const slope = Math.sqrt(tiltX * tiltX + tiltY * tiltY)
  const inclinationDeg = (Math.atan(slope) * 180) / Math.PI
  let declinationDeg = (Math.atan2(tiltY, tiltX) * 180) / Math.PI
  if (declinationDeg < 0) declinationDeg += 360
  if (!isFinite(declinationDeg)) declinationDeg = 0
  if (!isFinite(inclinationDeg)) return { declinationDeg, inclinationDeg: 0 }
  return { declinationDeg, inclinationDeg }
}

export function declIncToTilt(declinationDeg: number, inclinationDeg: number) {
  const decRad = (declinationDeg * Math.PI) / 180
  const incRad = (inclinationDeg * Math.PI) / 180
  const tanDip = Math.tan(incRad)
  return {
    tiltX: tanDip * Math.cos(decRad),
    tiltY: tanDip * Math.sin(decRad),
  }
}
