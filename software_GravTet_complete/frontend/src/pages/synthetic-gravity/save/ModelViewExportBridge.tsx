import { useThree } from '@react-three/fiber'
import { useCallback, useEffect, type MutableRefObject } from 'react'

export type ModelViewCaptureHandle = {
  capture: () => Promise<HTMLCanvasElement>
}

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

type ModelViewExportBridgeProps = {
  exportHandleRef: MutableRefObject<ModelViewCaptureHandle | null>
}

/** Captures the WebGL canvas exactly as the user left it (orbit / zoom / pan). */
export function ModelViewExportBridge({ exportHandleRef }: ModelViewExportBridgeProps) {
  const { gl, camera, scene, invalidate } = useThree()

  const capture = useCallback(async () => {
    invalidate()
    await waitForNextFrame()
    gl.render(scene, camera)

    const srcW = gl.domElement.width
    const srcH = gl.domElement.height
    const out = document.createElement('canvas')
    out.width = srcW
    out.height = srcH
    const ctx = out.getContext('2d')
    if (!ctx) {
      throw new Error('Could not create export canvas')
    }
    ctx.fillStyle = '#f3f4f6'
    ctx.fillRect(0, 0, srcW, srcH)
    ctx.drawImage(gl.domElement, 0, 0)
    return out
  }, [camera, gl, invalidate, scene])

  useEffect(() => {
    exportHandleRef.current = { capture }
    return () => {
      if (exportHandleRef.current?.capture === capture) {
        exportHandleRef.current = null
      }
    }
  }, [capture, exportHandleRef])

  return null
}
