/**
 * Top navigation: synthetic model picker, forward gravity method, mobile menu.
 */

import { forwardGravityOptions } from '../../pages/forward-gravity/constants/forwardMethods'
import { gravityOptions, migrateCatalogModelType } from '../../pages/synthetic-gravity/constants/synthetic'
import { gravityViews } from '../../routes/gravityViews'
import SyntheticModelSelectModal from '../modal/SyntheticModelSelectModal'
import { isAnalyticalClosedFormModelSupported } from '../../pages/forward-gravity/lib/analyticalClosedFormSupport'
import { isQuadratureTetraMeshModel } from '../../pages/synthetic-gravity/lib/gmshMeshSupport'
import type { ViewKey } from '../../types/view'
import { useState } from 'react'

// --- Props: navigation state lifted from `App` ---

type Props = {
  view: ViewKey
  setView: (v: ViewKey) => void
  gravityModel: string | null
  gravityModalOpen: boolean
  setGravityModalOpen: (v: boolean) => void
  forwardGravityModalOpen: boolean
  setForwardGravityModalOpen: (v: boolean) => void
  mobileMenuOpen: boolean
  setMobileMenuOpen: (v: boolean) => void
  setGravityModel: (v: string) => void
}

export default function MainHeader(props: Props) {
  const {
    view, setView, gravityModel,
    gravityModalOpen, setGravityModalOpen,
    forwardGravityModalOpen, setForwardGravityModalOpen, mobileMenuOpen, setMobileMenuOpen,
    setGravityModel,
  } = props
  const [showQuadratureModelTypeModal, setShowQuadratureModelTypeModal] = useState(false)
  const [showAnalyticalModelTypeModal, setShowAnalyticalModelTypeModal] = useState(false)
  const isQuadratureModelTypeSupported = Boolean(
    gravityModel && isQuadratureTetraMeshModel(gravityModel)
  )
  const isAnalyticalModelTypeSupported = isAnalyticalClosedFormModelSupported(gravityModel)
  const showGravityNav = view === 'home' || gravityViews.includes(view)

  const handleForwardMethodSelect = (targetView: ViewKey) => {
    const isQuadratureTarget = targetView.startsWith('quadrature_')
    const isAnalyticalTarget = targetView === 'analytical_closedform'
    if (isQuadratureTarget && !isQuadratureModelTypeSupported) {
      setShowQuadratureModelTypeModal(true)
      return
    }
    if (isAnalyticalTarget && !isAnalyticalModelTypeSupported) {
      setShowAnalyticalModelTypeModal(true)
      return
    }
    setView(targetView)
    setForwardGravityModalOpen(false)
  }

  // --- Logo + desktop nav (hidden on narrow screens; see mobile menu below) ---
  return (
    <header className="header">
      <button
        type="button"
        className="header-logo-button"
        onClick={() => setView('home')}
        aria-label="Go to home page"
      >
        <img src="/logo/logo_modeling.png" alt="Sarvandani Modelling Software logo" className="header-logo" />
      </button>

      <button type="button" className="header-menu-btn" onClick={() => setMobileMenuOpen(true)} aria-label="Open menu">
        <span className="header-menu-icon" />
      </button>

      <div className="header-nav-buttons">
        {showGravityNav && (
          <button className={`nav-button ${view === 'synthetic_gravity' ? 'active' : ''}`} onClick={() => setGravityModalOpen(true)}>
            Synthetic Gravity Model ▼
          </button>
        )}

        {/* Hidden for screenshots; Initial Model page/code kept intact. */}
        {false && showGravityNav && (
          <button
            type="button"
            className={`nav-button ${view === 'initial_model_gravity' ? 'active' : ''}`}
            onClick={() => setView('initial_model_gravity')}
          >
            Initial Model
          </button>
        )}

        {showGravityNav && (
          <button
            className={`nav-button ${view === 'analytical_closedform' || view.startsWith('quadrature_') ? 'active' : ''}`}
            onClick={() => setForwardGravityModalOpen(true)}
          >
            {(view === 'analytical_closedform' || view.startsWith('quadrature_'))
              ? (forwardGravityOptions.find((o) => o.value === view)?.label ?? 'Forward Gravity') + ' ▼'
              : 'Forward Gravity ▼'}
          </button>
        )}
      </div>

      {/* Forward gravity method picker modal */}
      {forwardGravityModalOpen && (
        <div className="forward-gravity-modal-overlay" onClick={() => setForwardGravityModalOpen(false)}>
          <div className="forward-gravity-modal" onClick={(e) => e.stopPropagation()}>
            <div className="forward-gravity-modal-header">
              <h2 className="forward-gravity-modal-title">Forward Gravity</h2>
              <button type="button" className="forward-gravity-modal-close" onClick={() => setForwardGravityModalOpen(false)} aria-label="Close">×</button>
            </div>
            <div className="forward-gravity-modal-list">
              {forwardGravityOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`forward-gravity-modal-item ${view === opt.value ? 'active' : ''}`}
                  onClick={() => handleForwardMethodSelect(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {gravityModalOpen && (
        <SyntheticModelSelectModal
          title="Synthetic Gravity — Select model"
          options={gravityOptions}
          selected={gravityModel}
          onSelect={(opt) => { setGravityModel(migrateCatalogModelType(opt) ?? opt); setView('synthetic_gravity') }}
          onClose={() => setGravityModalOpen(false)}
        />
      )}

      {mobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobile-menu-panel" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-menu-header">
              <h2 className="mobile-menu-title">Menu</h2>
              <button type="button" className="mobile-menu-close" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">×</button>
            </div>
            <div className="mobile-menu-list">
              {showGravityNav && (
                <button type="button" className={`mobile-menu-item ${view === 'synthetic_gravity' ? 'active' : ''}`} onClick={() => { setMobileMenuOpen(false); setGravityModalOpen(true) }}>
                  Synthetic Gravity Model
                </button>
              )}
              {/* Hidden for screenshots; Initial Model page/code kept intact. */}
              {false && showGravityNav && (
                <button
                  type="button"
                  className={`mobile-menu-item ${view === 'initial_model_gravity' ? 'active' : ''}`}
                  onClick={() => {
                    setMobileMenuOpen(false)
                    setView('initial_model_gravity')
                  }}
                >
                  Initial Model
                </button>
              )}
              {showGravityNav && (
                <button type="button" className={`mobile-menu-item ${view === 'analytical_closedform' || view.startsWith('quadrature_') ? 'active' : ''}`} onClick={() => { setMobileMenuOpen(false); setForwardGravityModalOpen(true) }}>
                  Forward Gravity
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {showQuadratureModelTypeModal && (
        <div className="forward-gravity-modal-overlay" onClick={() => setShowQuadratureModelTypeModal(false)}>
          <div className="forward-gravity-modal" onClick={(e) => e.stopPropagation()}>
            <div className="forward-gravity-modal-header">
              <h2 className="forward-gravity-modal-title">Unsupported Model Type for Quadrature</h2>
              <button
                type="button"
                className="forward-gravity-modal-close"
                onClick={() => setShowQuadratureModelTypeModal(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div style={{ padding: '18px 20px 20px 20px', color: '#374151', lineHeight: 1.5 }}>
              Quadrature second-order supports <strong>Tetrahedral</strong> model types. Please choose Tetrahedral
              and try again.
            </div>
          </div>
        </div>
      )}
      {showAnalyticalModelTypeModal && (
        <div className="forward-gravity-modal-overlay" onClick={() => setShowAnalyticalModelTypeModal(false)}>
          <div className="forward-gravity-modal" onClick={(e) => e.stopPropagation()}>
            <div className="forward-gravity-modal-header">
              <h2 className="forward-gravity-modal-title">Unsupported Model Type for Analytical</h2>
              <button
                type="button"
                className="forward-gravity-modal-close"
                onClick={() => setShowAnalyticalModelTypeModal(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div style={{ padding: '18px 20px 20px 20px', color: '#374151', lineHeight: 1.5 }}>
              Analytical closed-form supports <strong>Cube, Cuboid, Sphere, Ellipsoid, Vertical Cylinder, and Horizontal Cylinder</strong> (any mesh type). The solution does not depend on discretization.
              Please choose a supported model and try again.
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
