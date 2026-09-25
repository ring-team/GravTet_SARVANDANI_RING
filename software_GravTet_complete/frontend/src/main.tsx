/**
 * Vite/React entry: mounts the root `<App />`.
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles.css'
import App from './App'
import ErrorBoundary from './components/error/ErrorBoundary'

// --- Mount ---

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
