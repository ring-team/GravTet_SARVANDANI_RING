import type { SurfaceBounds } from '../lib/surfaceBounds'
import { EarthSurfacePlane } from './EarthSurfacePlane'
import { SurfaceObservationMarkers } from './SurfaceObservationMarkers'

export type SyntheticModelObservationProps = {
  displayObservationPoints: boolean
  onDisplayObservationPointsChange: (value: boolean) => void
  numReceiversX: number
  numReceiversY: number
  surfaceBounds: SurfaceBounds
}

interface SyntheticSurfaceLayerProps {
  sizeX?: number
  sizeY?: number
  displayObservationPoints?: boolean
  numReceiversX?: number
  numReceiversY?: number
  surfaceBounds?: SurfaceBounds
}

export function SyntheticSurfaceLayer({
  sizeX = 200,
  sizeY = 200,
  displayObservationPoints = false,
  numReceiversX = 100,
  numReceiversY = 100,
  surfaceBounds,
}: SyntheticSurfaceLayerProps) {
  return (
    <>
      <EarthSurfacePlane sizeX={sizeX} sizeY={sizeY} surfaceBounds={surfaceBounds} />
      {displayObservationPoints && surfaceBounds ? (
        <SurfaceObservationMarkers
          numReceiversX={numReceiversX}
          numReceiversY={numReceiversY}
          surfaceBounds={surfaceBounds}
        />
      ) : null}
    </>
  )
}
