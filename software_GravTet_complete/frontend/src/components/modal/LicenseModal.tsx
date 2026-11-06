/**
 * Dialog showing GravTet license and distribution details.
 */

import { createPortal } from 'react-dom'
import { APP_LICENSE } from '../../config/constants/appLicense'

export default function LicenseModal({ onClose }: { onClose: () => void }) {
  const modal = (
    <div className="license-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="license-modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="license-modal-title"
        aria-modal="true"
      >
        <div className="license-modal-header">
          <h2 id="license-modal-title" className="license-modal-title">
            {APP_LICENSE.softwareName} — {APP_LICENSE.licenseName}
          </h2>
          <button type="button" className="license-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="license-modal-body">
          <p className="license-modal-lead">{APP_LICENSE.licenseSummary}</p>
          <p className="license-modal-meta">{APP_LICENSE.copyright}</p>
          <dl className="license-modal-details">
            <div>
              <dt>License text</dt>
              <dd>
                <a href={APP_LICENSE.licenseUrl} target="_blank" rel="noopener noreferrer">
                  {APP_LICENSE.licenseUrl}
                </a>
              </dd>
            </div>
            <div>
              <dt>Source code</dt>
              <dd>
                <a href={APP_LICENSE.repositoryUrl} target="_blank" rel="noopener noreferrer">
                  {APP_LICENSE.repositoryUrl}
                </a>
              </dd>
            </div>
            <div>
              <dt>Maintenance</dt>
              <dd>{APP_LICENSE.maintenance}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
