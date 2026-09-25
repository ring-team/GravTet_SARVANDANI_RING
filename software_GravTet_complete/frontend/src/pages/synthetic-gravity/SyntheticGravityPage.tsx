/**
 * Synthetic Gravity page (header "Synthetic Gravity" button): per-shape 3D model editors
 * (mesh + sliders) for the selected catalog model.
 *
 * This file is a thin dispatcher: it maps the `content` key to the matching shape editor
 * and forwards parameters from `p`. It owns no 3D logic of its own.
 */

import {
  Cube3DView,
  Cuboid3DView,
  Sphere3DView,
  Ellipsoid3DView,
  VerticalCylinder3DView,
  HorizontalCylinder3DView,
  FourCubes3DView,
  FaultedBlockModel3DView,
  ValleyMountainModel3DView,
} from './shared/synthetic3DViews'


export default function SyntheticGravityPage({ content, p }: { content: string; p: any }) {
  // Observation-grid + mesh props are identical for every shape, so define them once
  // and spread `{...shared}` into each editor below.
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

  // --- Primitives ---
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

  if (content === 'cuboid3d')
    return (
      <Cuboid3DView
        modelType={p.gravityModel}
        x={p.cuboidX} y={p.cuboidY} z={p.cuboidZ} h={p.cuboidH} density={p.cuboidDensity}
        onXChange={p.setCuboidX} onYChange={p.setCuboidY} onZChange={p.setCuboidZ}
        onHChange={p.setCuboidH} onDensityChange={p.setCuboidDensity}
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

  if (content === 'ellipsoid3d')
    return (
      <Ellipsoid3DView
        modelType={p.gravityModel}
        a={p.ellipsoidA} b={p.ellipsoidB} c={p.ellipsoidC} h={p.ellipsoidH}
        density={p.ellipsoidDensity}
        onAChange={p.setEllipsoidA} onBChange={p.setEllipsoidB} onCChange={p.setEllipsoidC}
        onHChange={p.setEllipsoidH} onDensityChange={p.setEllipsoidDensity}
        {...shared}
      />
    )

  // --- Cylinders ---
  if (content === 'verticalcylinder3d')
    return (
      <VerticalCylinder3DView
        modelType={p.gravityModel}
        radius={p.verticalCylinderRadius} height={p.verticalCylinderHeight}
        h={p.verticalCylinderH} density={p.verticalCylinderDensity}
        onRadiusChange={p.setVerticalCylinderRadius} onHeightChange={p.setVerticalCylinderHeight}
        onHChange={p.setVerticalCylinderH} onDensityChange={p.setVerticalCylinderDensity}
        {...shared}
      />
    )

  if (content === 'horizontalcylinder3d')
    return (
      <HorizontalCylinder3DView
        modelType={p.gravityModel}
        radius={p.horizontalCylinderRadius} length={p.horizontalCylinderLength}
        h={p.horizontalCylinderH} density={p.horizontalCylinderDensity}
        onRadiusChange={p.setHorizontalCylinderRadius} onLengthChange={p.setHorizontalCylinderLength}
        onHChange={p.setHorizontalCylinderH} onDensityChange={p.setHorizontalCylinderDensity}
        {...shared}
      />
    )

  // --- Multi-body / structural ---
  if (content === 'fourcubes3d')
    return (
      <FourCubes3DView
        modelType={p.gravityModel}
        cube1X={p.cube1X} cube1Y={p.cube1Y} cube1Z={p.cube1Z} cube1H={p.cube1H} cube1Density={p.cube1Density}
        cube2X={p.cube2X} cube2Y={p.cube2Y} cube2Z={p.cube2Z} cube2H={p.cube2H} cube2Density={p.cube2Density}
        cube3X={p.cube3X} cube3Y={p.cube3Y} cube3Z={p.cube3Z} cube3H={p.cube3H} cube3Density={p.cube3Density}
        cube4X={p.cube4X} cube4Y={p.cube4Y} cube4Z={p.cube4Z} cube4H={p.cube4H} cube4Density={p.cube4Density}
        spacingX={p.spacingX} spacingY={p.spacingY}
        cube1OffsetX={p.cube1OffsetX} cube1OffsetY={p.cube1OffsetY}
        cube2OffsetX={p.cube2OffsetX} cube2OffsetY={p.cube2OffsetY}
        cube3OffsetX={p.cube3OffsetX} cube3OffsetY={p.cube3OffsetY}
        cube4OffsetX={p.cube4OffsetX} cube4OffsetY={p.cube4OffsetY}
        onCube1XChange={p.setCube1X} onCube1YChange={p.setCube1Y} onCube1ZChange={p.setCube1Z} onCube1HChange={p.setCube1H} onCube1DensityChange={p.setCube1Density}
        onCube2XChange={p.setCube2X} onCube2YChange={p.setCube2Y} onCube2ZChange={p.setCube2Z} onCube2HChange={p.setCube2H} onCube2DensityChange={p.setCube2Density}
        onCube3XChange={p.setCube3X} onCube3YChange={p.setCube3Y} onCube3ZChange={p.setCube3Z} onCube3HChange={p.setCube3H} onCube3DensityChange={p.setCube3Density}
        onCube4XChange={p.setCube4X} onCube4YChange={p.setCube4Y} onCube4ZChange={p.setCube4Z} onCube4HChange={p.setCube4H} onCube4DensityChange={p.setCube4Density}
        onSpacingXChange={p.setSpacingX} onSpacingYChange={p.setSpacingY}
        onCube1OffsetXChange={p.setCube1OffsetX} onCube1OffsetYChange={p.setCube1OffsetY}
        onCube2OffsetXChange={p.setCube2OffsetX} onCube2OffsetYChange={p.setCube2OffsetY}
        onCube3OffsetXChange={p.setCube3OffsetX} onCube3OffsetYChange={p.setCube3OffsetY}
        onCube4OffsetXChange={p.setCube4OffsetX} onCube4OffsetYChange={p.setCube4OffsetY}
        {...shared}
      />
    )

  if (content === 'faultedblock3d')
    return (
      <FaultedBlockModel3DView
        modelType={p.gravityModel}
        x={p.faultedBlockX} y={p.faultedBlockY} z={p.faultedBlockZ}
        faultOffset={p.faultedBlockFaultOffset} h={p.faultedBlockH} density={p.faultedBlockDensity}
        onXChange={p.setFaultedBlockX} onYChange={p.setFaultedBlockY} onZChange={p.setFaultedBlockZ}
        onFaultOffsetChange={p.setFaultedBlockFaultOffset} onHChange={p.setFaultedBlockH}
        onDensityChange={p.setFaultedBlockDensity}
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

  // --- Fallback placeholder (no catalog model chosen yet) ---
  if (content === 'Gravity Data Modeling')
    return (
      <div className="content-card">
        <div className="magnetic-no-model"><h3>GravTet: Choose synthetic model</h3></div>
      </div>
    )
  return null
}
