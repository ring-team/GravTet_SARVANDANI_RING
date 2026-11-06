import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { SurfaceBounds } from '../lib/surfaceBounds'
import { buildSurfaceReceiverPositionsThreeJs } from '../default_data/surfaceReceiverPositions'

function createTriangleTexture(): THREE.CanvasTexture {
  const size = 32
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = '#000000'
  ctx.beginPath()
  ctx.moveTo(size / 2, 3)
  ctx.lineTo(size - 3, size - 3)
  ctx.lineTo(3, size - 3)
  ctx.closePath()
  ctx.fill()
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

interface SurfaceObservationMarkersProps {
  numReceiversX: number
  numReceiversY: number
  surfaceBounds: SurfaceBounds
}

export function SurfaceObservationMarkers({
  numReceiversX,
  numReceiversY,
  surfaceBounds,
}: SurfaceObservationMarkersProps) {
  const { geometry, pointSize } = useMemo(() => {
    const positions = buildSurfaceReceiverPositionsThreeJs(numReceiversX, numReceiversY, surfaceBounds)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const nx = Math.max(1, Math.round(numReceiversX))
    const ny = Math.max(1, Math.round(numReceiversY))
    const spanX = surfaceBounds.xMax - surfaceBounds.xMin
    const spanY = surfaceBounds.yMax - surfaceBounds.yMin
    const spacing = Math.min(nx > 1 ? spanX / (nx - 1) : spanX, ny > 1 ? spanY / (ny - 1) : spanY)
    const size = THREE.MathUtils.clamp(spacing * 0.45, 2, 14)

    return { geometry: g, pointSize: size }
  }, [numReceiversX, numReceiversY, surfaceBounds])

  const texture = useMemo(() => createTriangleTexture(), [])

  useEffect(() => {
    return () => {
      texture.dispose()
      geometry.dispose()
    }
  }, [texture, geometry])

  return (
    <points geometry={geometry} renderOrder={2}>
      <pointsMaterial
        map={texture}
        color="#000000"
        size={pointSize}
        sizeAttenuation
        transparent
        alphaTest={0.1}
        depthTest={false}
        depthWrite={false}
      />
    </points>
  )
}
