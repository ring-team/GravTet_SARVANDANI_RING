/**
 * Semi-transparent ground plane at y = 0. When `surfaceBounds` is set, matches the forward map extent.
 */
import * as THREE from 'three'
import type { SurfaceBounds } from '../lib/surfaceBounds'

interface EarthSurfacePlaneProps {
  /** Fallback when `surfaceBounds` is omitted (legacy 1.5× model size). */
  sizeX?: number
  sizeY?: number
  /** Forward observation map extent — preferred for synthetic + observation overlay. */
  surfaceBounds?: SurfaceBounds
}

export function EarthSurfacePlane({ sizeX = 200, sizeY = 200, surfaceBounds }: EarthSurfacePlaneProps) {
  const width = surfaceBounds
    ? surfaceBounds.xMax - surfaceBounds.xMin
    : Math.max(1, sizeX * 1.5) * 2
  const depth = surfaceBounds
    ? surfaceBounds.yMax - surfaceBounds.yMin
    : Math.max(1, sizeY * 1.5) * 2
  const centerX = surfaceBounds ? (surfaceBounds.xMin + surfaceBounds.xMax) * 0.5 : 0
  const centerZ = surfaceBounds ? (surfaceBounds.yMin + surfaceBounds.yMax) * 0.5 : 0

  return (
    <mesh position={[centerX, 0, centerZ]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={0}>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial
        color="#e5e7eb"
        opacity={0.6}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}
