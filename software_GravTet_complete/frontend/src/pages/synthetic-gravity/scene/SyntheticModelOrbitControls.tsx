import { OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import {
  syntheticModelCameraDistance,
  syntheticModelCameraPosition,
} from './syntheticModelDefaultCamera'

type SyntheticModelOrbitControlsProps = {
  viewHalfExtent: number
}

export function SyntheticModelOrbitControls({ viewHalfExtent }: SyntheticModelOrbitControlsProps) {
  const { camera } = useThree()
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const maxDistance = Math.max(2_000_000, syntheticModelCameraDistance(viewHalfExtent) * 5)

  useLayoutEffect(() => {
    const [x, y, z] = syntheticModelCameraPosition(viewHalfExtent)
    camera.up.set(0, 1, 0)
    camera.position.set(x, y, z)
    camera.lookAt(0, 0, 0)
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.updateProjectionMatrix()
    }
    const controls = controlsRef.current
    if (controls) {
      controls.target.set(0, 0, 0)
      controls.update()
    }
    // Mount-only default view when a synthetic model is opened.
  }, [camera])

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      target={[0, 0, 0]}
      enablePan
      enableZoom
      enableRotate
      minDistance={10}
      maxDistance={maxDistance}
    />
  )
}
