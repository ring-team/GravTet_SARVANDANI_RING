import { useEffect, useState } from 'react'
import { api } from '../../../services/api'
import { getGravityHealthUrl } from '../../../config/api/api.config'
import { isExecutionBundle } from '../../../config/appVariant'

export default function BackendConnectionBanner() {
  const [backendOk, setBackendOk] = useState<boolean | null>(null)
  const healthUrl = getGravityHealthUrl()

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const h = await api.health()
        if (!cancelled) setBackendOk(h.status === 'ok')
      } catch {
        if (!cancelled) setBackendOk(false)
      }
    }
    void check()
    const id = window.setInterval(() => void check(), 15000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  if (backendOk !== false) return null

  return (
    <div
      role="alert"
      style={{
        margin: '0 0 12px',
        padding: '10px 14px',
        borderRadius: 8,
        background: '#3b1212',
        border: '1px solid #c44',
        color: '#fdd',
        fontSize: 14,
        lineHeight: 1.45,
      }}
    >
      <strong>Gravity backend is not reachable.</strong> Calculations and analysis will fail until it is
      running.{' '}
      {isExecutionBundle ? (
        <>
          Start GravTet from the execution folder: macOS{' '}
          <code style={{ background: '#2a0a0a', padding: '2px 6px' }}>macos/Launcher_GravTet.command</code>
          , Linux <code style={{ background: '#2a0a0a', padding: '2px 6px' }}>linux/Launch_GravTet.sh</code>
          , or Windows <code style={{ background: '#2a0a0a', padding: '2px 6px' }}>windows\Launch_GravTet.bat</code>
          , then open{' '}
          <a href={healthUrl} style={{ color: '#9cf' }}>
            {healthUrl}
          </a>{' '}
          (should show <code>status: ok</code>) and refresh this page.
        </>
      ) : (
        <>
          From the project folder run{' '}
          <code style={{ background: '#2a0a0a', padding: '2px 6px' }}>./scripts/dev.sh</code>, then open{' '}
          <a href={healthUrl} style={{ color: '#9cf' }}>
            {healthUrl}
          </a>{' '}
          (should show <code>status: ok</code>) and refresh this page.
        </>
      )}
    </div>
  )
}
