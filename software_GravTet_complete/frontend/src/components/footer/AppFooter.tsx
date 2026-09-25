/**
 * Application footer: product name, copyright, and license details.
 */

import { useState } from 'react'
import { APP_LICENSE } from '../../config/constants/appLicense'
import LicenseModal from '../modal/LicenseModal'

export default function AppFooter() {
  const [licenseOpen, setLicenseOpen] = useState(false)
  const year = new Date().getFullYear()

  return (
    <footer className="app-footer">
      <div className="app-footer-inner">
        <span className="app-footer-brand">{APP_LICENSE.softwareName}</span>
        <span className="app-footer-sep" aria-hidden="true">
          ·
        </span>
        <span className="app-footer-copy">
          {APP_LICENSE.copyright} · {year}
        </span>
        <button type="button" className="app-footer-license-btn" onClick={() => setLicenseOpen(true)}>
          {APP_LICENSE.licenseName}
        </button>
      </div>
      {licenseOpen ? <LicenseModal onClose={() => setLicenseOpen(false)} /> : null}
    </footer>
  )
}
