/**
 * Synthetic Gravity page (header "Synthetic Gravity" button): per-shape 3D model editors
 * (mesh + sliders) for the selected catalog model.
 */

import { Cube3DView, Sphere3DView, ValleyMountainModel3DView } from './shared/synthetic3DViews'

export default function SyntheticGravityPage({ content, p }: { content: string; p: any }) {
  const shared = {
    numSourcesX: p.forwardNumSourcesX,
    numSourcesY: p.forwardNumSourcesY,
    numSourcesZ: p.forwardNumSourcesZ,
    onNumSourcesXChange: p.setForwardNumSourcesX,
    onNumSourcesYChange: p.setForwardNumSourcesY,
    onNumSourcesZChange: p.setForwardNumSourcesZ,
    sharedUnstructuredMesh: p.sharedUnstructuredMesh,
    displayObservationPoints: p.displayObservationPoints,
    onDisplayObservationPointsChange: p.setDisplayObservationPoints,
    numReceiversX: p.forwardNumReceiversX,
    numReceiversY: p.forwardNumReceiversY,
    surfaceBounds: p.forwardSurfaceBounds,
  }

  if (content === 'cube3d')
    return (
      <Cube3DView
        modelType={p.gravityModel}
        x={p.cubeX} y={p.cubeY} z={p.cubeZ} h={p.cubeH} density={p.cubeDensity}
        onXChange={p.setCubeX} onYChange={p.setCubeY} onZChange={p.setCubeZ}
        onHChange={p.setCubeH} onDensityChange={p.setCubeDensity}
        {...shared}
      />
    )

  if (content === 'sphere3d')
    return (
      <Sphere3DView
        modelType={p.gravityModel}
        radius={p.sphereRadius} h={p.sphereH} density={p.sphereDensity}
        onRadiusChange={p.setSphereRadius} onHChange={p.setSphereH}
        onDensityChange={p.setSphereDensity}
        {...shared}
      />
    )

  if (content === 'valleymountain3d')
    return (
      <ValleyMountainModel3DView
        modelType={p.gravityModel}
        x={p.valleyMountainX} y={p.valleyMountainY} z={p.valleyMountainZ} h={p.valleyMountainH}
        mountainDensity={p.valleyMountainMountainDensity} halfSpaceDensity={p.valleyMountainValleyDensity}
        mountainHeight={p.valleyMountainHeight} valleyDepth={p.valleyMountainDepth}
        onXChange={p.setValleyMountainX} onYChange={p.setValleyMountainY} onZChange={p.setValleyMountainZ}
        onHChange={p.setValleyMountainH}
        onMountainDensityChange={p.setValleyMountainMountainDensity}
        onHalfSpaceDensityChange={p.setValleyMountainValleyDensity}
        onMountainHeightChange={p.setValleyMountainHeight} onValleyDepthChange={p.setValleyMountainDepth}
        {...shared}
      />
    )

  if (content === 'Gravity Data Modeling')
    return (
      <div className="content-card">
        <div className="magnetic-no-model"><h3>GravTet: Choose synthetic model</h3></div>
      </div>
    )
  return null
}
