/**
 * Catches render errors so a failed subtree does not leave a blank #root.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }

type State = { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 24,
            maxWidth: 720,
            margin: '48px auto',
            fontFamily: 'system-ui, sans-serif',
            color: '#111',
            background: '#fff',
            borderRadius: 8,
            border: '1px solid #e5e7eb',
          }}
        >
          <h1 style={{ fontSize: '1.25rem', marginTop: 0 }}>The app hit a runtime error</h1>
          <p style={{ color: '#4b5563' }}>
            Open the browser developer console (F12) for the full stack trace. If you just updated
            the code, try a hard refresh (reload bypassing cache).
          </p>
          <pre
            style={{
              background: '#f9fafb',
              padding: 12,
              overflow: 'auto',
              fontSize: 13,
              borderRadius: 6,
            }}
          >
            {this.state.error.message}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}
