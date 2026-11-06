/**
 * Initial model gravity UI/logic: `AnomalyColorbarRamp.tsx`.
 */

import { useId, useMemo, type ReactNode } from 'react'
import type { ImportedColormapId } from './initialModel/colormap'
import { colormapRgb, rgbCss } from './initialModel/colormap'

/** SVG gradient ramp (low t = bottom, high t = top). */
export function AnomalyColorbarRamp({ cmap }: { cmap: ImportedColormapId }) {
  const gid = `anomaly-cbar-${useId().replace(/:/g, '')}`
  const stops = useMemo(() => {
    const n = 32
    const els: ReactNode[] = []
    for (let i = 0; i <= n; i++) {
      const off = `${(i / n) * 100}%`
      const t = i / n
      const c = rgbCss(colormapRgb(cmap, t))
      els.push(<stop key={i} offset={off} stopColor={c} />)
    }
    return els
  }, [cmap])
  return (
    <div className="initial-model-colorbar-ramp">
      <svg
        className="initial-model-colorbar-svg"
        viewBox="0 0 20 200"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id={gid} x1="10" y1="200" x2="10" y2="0" gradientUnits="userSpaceOnUse">
            {stops}
          </linearGradient>
        </defs>
        <rect width="20" height="200" fill={`url(#${gid})`} />
      </svg>
    </div>
  )
}
