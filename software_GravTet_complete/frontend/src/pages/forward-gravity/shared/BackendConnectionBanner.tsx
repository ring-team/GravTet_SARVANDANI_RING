import { useEffect, useState } from 'react'
import { api } from '../../../services/api'

export default function BackendConnectionBanner() {
  const [backendOk, setBackendOk] = useState<boolean | null>(null)

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
      running. From the project folder run{' '}
      <code style={{ background: '#2a0a0a', padding: '2px 6px' }}>./scripts/dev.sh</code>, then open{' '}
      <a href="http://localhost:5002/api/health" style={{ color: '#9cf' }}>
        http://localhost:5002/api/health
      </a>{' '}
      (should show <code>status: ok</code>) and refresh this page.
    </div>
  )
}
