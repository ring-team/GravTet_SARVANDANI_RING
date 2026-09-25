import { useRef } from 'react'
import type { ModelViewCaptureHandle } from './ModelViewExportBridge'

export function useModelViewExport() {
  const exportHandleRef = useRef<ModelViewCaptureHandle | null>(null)
  return { exportHandleRef }
}
