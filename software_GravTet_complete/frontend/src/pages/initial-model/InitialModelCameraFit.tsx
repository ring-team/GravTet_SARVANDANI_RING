/**
 * Initial model gravity UI/logic: `InitialModelCameraFit.tsx`.
 */

import { useEffect, type MutableRefObject, type RefObject } from 'react'
import { useThree } from '@react-three/fiber'
import type { PerspectiveCamera } from 'three'

export type CameraFitParams = {
  far: number
  minDistance: number
  maxDistance: number
  target: [number, number, number]
  camPos: [number, number, number]
}

type ControlsLike = {
  target: { set: (x: number, y: number, z: number) => void }
  object: { position: { set: (x: number, y: number, z: number) => void } }
  minDistance: number
  maxDistance: number
  update: () => void
}

type Props = {
  controlsRef: RefObject<ControlsLike | null>
  fit: CameraFitParams
  didInitialFitRef: MutableRefObject<boolean>
}

export function InitialModelCameraFit({ controlsRef, fit, didInitialFitRef }: Props) {
  const { camera } = useThree()
  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return

    const cam = camera as PerspectiveCamera
    cam.near = 0.1
    cam.far = fit.far
    cam.updateProjectionMatrix()

    if (!didInitialFitRef.current) {
      controls.target.set(fit.target[0], fit.target[1], fit.target[2])
      controls.object.position.set(fit.camPos[0], fit.camPos[1], fit.camPos[2])
      didInitialFitRef.current = true
    }

    controls.minDistance = fit.minDistance
    controls.maxDistance = fit.maxDistance

    controls.update()
  }, [fit, camera, controlsRef, didInitialFitRef])
  return null
}
