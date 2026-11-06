/**
 * Initial model gravity UI/logic: `InitialModelAnomalyColorbar.tsx`.
 */

import { AnomalyColorbarRamp } from './AnomalyColorbarRamp'
import {
  anomalyTickCssColor,
  IMPORTED_COLORMAP_OPTIONS,
  type ImportedColormapId,
} from './initialModel/colormap'
import { formatAnomalyTick } from './initialModel/math'

type Props = {
  minV: number
  maxV: number
  importedColormap: ImportedColormapId
  onColormapChange: (id: ImportedColormapId) => void
}

export function InitialModelAnomalyColorbar({ minV, maxV, importedColormap, onColormapChange }: Props) {
  return (
    <aside className="initial-model-colorbar" aria-label="Gravity anomaly scale in milliGal">
      <div className="initial-model-colorbar-title">mGal</div>
      <div className="initial-model-colorbar-inner">
        <span
          className="initial-model-colorbar-tick initial-model-colorbar-tick-max"
          style={{ color: anomalyTickCssColor(importedColormap, true) }}
        >
          {formatAnomalyTick(maxV)}
        </span>
        <AnomalyColorbarRamp cmap={importedColormap} />
        <span
          className="initial-model-colorbar-tick initial-model-colorbar-tick-min"
          style={{ color: anomalyTickCssColor(importedColormap, false) }}
        >
          {formatAnomalyTick(minV)}
        </span>
      </div>
      <div className="initial-model-cmap-picker" role="radiogroup" aria-label="Anomaly colormap">
        {IMPORTED_COLORMAP_OPTIONS.map((opt) => (
          <label key={opt.id} className="initial-model-cmap-option">
            <input
              type="radio"
              name="imported-colormap"
              value={opt.id}
              checked={importedColormap === opt.id}
              onChange={() => onColormapChange(opt.id)}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
    </aside>
  )
}
