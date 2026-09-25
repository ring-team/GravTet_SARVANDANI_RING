/**
 * Root React application: routing state + composition of the gravity pages.
 * Heavy forward-model state lives in `useForwardModelControls`; run state in `useGravityRuns`.
 */

import { useEffect, useState } from 'react'
import type { InitialModel } from './pages/initial-model/initialModel/types'
import type { ViewKey } from './types/view'
import MainHeader from './components/header/MainHeader'
import AppFooter from './components/footer/AppFooter'
import BackendConnectionBanner from './pages/forward-gravity/shared/BackendConnectionBanner'
import { ForwardGravityMapExtentProvider } from './pages/forward-gravity/shared/ForwardGravityMapExtentContext'
import { useGravityAppState } from './hooks/useGravityAppState'
import GravityPageRegistry from './pages/GravityPageRegistry'
import { pathToView, viewToPath } from './routes/routes.config'

export default function App() {
  // --- Routing, catalog model, modals ---
  const [view, setView] = useState<ViewKey>(() => pathToView(window.location.pathname))
  const [initialModel, setInitialModel] = useState<InitialModel | null>(null)
  const [gravityModel, setGravityModel] = useState<string | null>(null)
  const [gravityModalOpen, setGravityModalOpen] = useState(false)
  const [forwardGravityModalOpen, setForwardGravityModalOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Keep the address bar in sync with the active view (preserving any ?query, e.g. ?model=).
  useEffect(() => {
    const target = viewToPath[view]
    if (window.location.pathname !== target) {
      window.history.pushState({}, '', target + window.location.search)
    }
  }, [view])

  // Restore the view when the user presses the browser Back/Forward buttons.
  useEffect(() => {
    const onPopState = () => setView(pathToView(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const { content, is3DContent, pageProps, gravityPageProps, runStore } = useGravityAppState({
    view,
    gravityModel,
    setGravityModel,
  })

  // --- Render: layout + gravity pages ---
  return (
    <div className={view === 'home' ? 'app-layout app-layout--with-footer' : 'app-layout'}>
      <MainHeader
        view={view}
        setView={setView}
        gravityModel={gravityModel}
        gravityModalOpen={gravityModalOpen}
        setGravityModalOpen={setGravityModalOpen}
        forwardGravityModalOpen={forwardGravityModalOpen}
        setForwardGravityModalOpen={setForwardGravityModalOpen}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        setGravityModel={setGravityModel}
      />
      <main className={is3DContent ? 'content content-3d' : 'content'}>
        <BackendConnectionBanner />
        <ForwardGravityMapExtentProvider>
          <GravityPageRegistry
            content={content}
            pageProps={pageProps}
            gravityPageProps={gravityPageProps}
            initialModel={initialModel}
            setInitialModel={setInitialModel}
            runStore={runStore}
          />
        </ForwardGravityMapExtentProvider>
      </main>
      {view === 'home' && <AppFooter />}
    </div>
  )
}
