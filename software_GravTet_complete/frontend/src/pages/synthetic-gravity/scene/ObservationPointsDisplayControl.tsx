interface ObservationPointsDisplayControlProps {
  displayObservationPoints: boolean
  onDisplayObservationPointsChange: (value: boolean) => void
  numReceiversX: number
  numReceiversY: number
}

export function ObservationPointsDisplayControl({
  displayObservationPoints,
  onDisplayObservationPointsChange,
  numReceiversX,
  numReceiversY,
}: ObservationPointsDisplayControlProps) {
  const nx = Math.max(0, Math.round(numReceiversX))
  const ny = Math.max(0, Math.round(numReceiversY))

  return (
    <div>
      <div className="control-group">
        <label className="render-style-option">
          <input
            type="checkbox"
            checked={displayObservationPoints}
            onChange={(e) => onDisplayObservationPointsChange(e.target.checked)}
          />
          <span>Display observation point</span>
        </label>
        {displayObservationPoints ? (
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9, lineHeight: 1.45 }}>
            observation points : {nx} × {ny} = {nx * ny}
          </div>
        ) : null}
      </div>
      <div
        role="separator"
        style={{ marginTop: 12, marginBottom: 4, borderTop: '1px solid #e5e7eb' }}
      />
    </div>
  )
}
