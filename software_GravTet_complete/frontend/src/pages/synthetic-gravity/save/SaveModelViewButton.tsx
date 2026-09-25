import { useState, type RefObject } from 'react'
import { downloadModel3DViewPng } from './saveModel3DView'
import type { ModelViewCaptureHandle } from './ModelViewExportBridge'

type SaveModelViewButtonProps = {
  viewRef: RefObject<HTMLElement | null>
  exportHandleRef?: RefObject<ModelViewCaptureHandle | null>
  filenameBase: string
}

export default function SaveModelViewButton({ viewRef, exportHandleRef, filenameBase }: SaveModelViewButtonProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    const root = viewRef.current
    if (!root) {
      setError('Model view is not ready')
      return
    }
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await downloadModel3DViewPng(root, filenameBase, exportHandleRef)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save model image')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="model-view-export">
      <button type="button" className="model-view-export-btn" onClick={() => void handleSave()}>
        Save model view (PNG)
      </button>
      {error ? <p className="model-view-export-error">{error}</p> : null}
    </div>
  )
}
