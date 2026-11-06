import { Canvas, type CanvasProps } from '@react-three/fiber'
import { useMemo, type MutableRefObject } from 'react'
import { ModelViewExportBridge, type ModelViewCaptureHandle } from '../save/ModelViewExportBridge'
import { syntheticModelDefaultCamera } from './syntheticModelDefaultCamera'
import { SyntheticModelOrbitControls } from './SyntheticModelOrbitControls'

export type SyntheticModelCanvasProps = Omit<CanvasProps, 'camera'> & {
  exportHandleRef?: MutableRefObject<ModelViewCaptureHandle | null>
  /** Horizontal half-extent for default corner camera (see `syntheticModelViewHalfExtent`). */
  viewHalfExtent: number
}

/** R3F canvas with drawing buffer preserved so PNG export works after render. */
export function SyntheticModelCanvas({
  exportHandleRef,
  viewHalfExtent,
  children,
  ...props
}: SyntheticModelCanvasProps) {
  const camera = useMemo(() => syntheticModelDefaultCamera(viewHalfExtent), [viewHalfExtent])

  return (
    <Canvas gl={{ preserveDrawingBuffer: true }} camera={camera} {...props}>
      <SyntheticModelOrbitControls viewHalfExtent={viewHalfExtent} />
      {exportHandleRef ? <ModelViewExportBridge exportHandleRef={exportHandleRef} /> : null}
      {children}
    </Canvas>
  )
}
