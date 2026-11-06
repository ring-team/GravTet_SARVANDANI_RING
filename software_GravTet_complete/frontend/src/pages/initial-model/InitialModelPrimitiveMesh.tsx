/**
 * Initial model gravity UI/logic: `InitialModelPrimitiveMesh.tsx`.
 */

import type { ReactNode } from 'react'
import type { InitialModelPrimitive } from './initialModel/types'
import { clamp } from './initialModel/math'

export function meshForPrimitive(p: InitialModelPrimitive): ReactNode {
  if (p.type !== 'box') return null

  const colorIntensity = clamp((p.density - 500) / 2500, 0, 1)
  const r = Math.round(30 + colorIntensity * 200)
  const g = Math.round(80 + colorIntensity * 130)
  const b = Math.round(120 + colorIntensity * 80)
  const color = `rgb(${r}, ${g}, ${b})`

  return (
    <mesh key={p.id} position={[p.centerX, p.centerZ, p.centerY]}>
      <boxGeometry args={[p.sizeX, p.sizeZ, p.sizeY]} />
      <meshStandardMaterial color={color} metalness={0.2} roughness={0.25} transparent opacity={0.6} />
    </mesh>
  )
}
