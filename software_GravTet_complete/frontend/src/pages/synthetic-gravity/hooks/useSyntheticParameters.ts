/**
 * Central React state for synthetic model sliders.
 */

import { useState } from 'react'

export default function useSyntheticParameters() {
  // --- Primitive shapes (gravity density) ---
  const [cubeX, setCubeX] = useState(100)
  const [cubeY, setCubeY] = useState(100)
  const [cubeZ, setCubeZ] = useState(100)
  const [cubeH, setCubeH] = useState(30)
  const [cubeDensity, setCubeDensity] = useState(2500)

  const [cuboidX, setCuboidX] = useState(400)
  const [cuboidY, setCuboidY] = useState(100)
  const [cuboidZ, setCuboidZ] = useState(150)
  const [cuboidH, setCuboidH] = useState(30)
  const [cuboidDensity, setCuboidDensity] = useState(2500)

  const [sphereRadius, setSphereRadius] = useState(100)
  const [sphereH, setSphereH] = useState(30)
  const [sphereDensity, setSphereDensity] = useState(2500)

  const [ellipsoidA, setEllipsoidA] = useState(200)
  const [ellipsoidB, setEllipsoidB] = useState(100)
  const [ellipsoidC, setEllipsoidC] = useState(150)
  const [ellipsoidH, setEllipsoidH] = useState(30)
  const [ellipsoidDensity, setEllipsoidDensity] = useState(2500)

  const [verticalCylinderRadius, setVerticalCylinderRadius] = useState(50)
  const [verticalCylinderHeight, setVerticalCylinderHeight] = useState(100)
  const [verticalCylinderH, setVerticalCylinderH] = useState(30)
  const [verticalCylinderDensity, setVerticalCylinderDensity] = useState(2500)

  const [horizontalCylinderRadius, setHorizontalCylinderRadius] = useState(50)
  const [horizontalCylinderLength, setHorizontalCylinderLength] = useState(100)
  const [horizontalCylinderH, setHorizontalCylinderH] = useState(30)
  const [horizontalCylinderDensity, setHorizontalCylinderDensity] = useState(2500)

  // --- Four-cubes layout (positions, spacing, offsets) ---
  const [cube1X, setCube1X] = useState(20)
  const [cube1Y, setCube1Y] = useState(20)
  const [cube1Z, setCube1Z] = useState(20)
  const [cube1H, setCube1H] = useState(2)
  const [cube1Density, setCube1Density] = useState(2500)
  const [cube2X, setCube2X] = useState(20)
  const [cube2Y, setCube2Y] = useState(20)
  const [cube2Z, setCube2Z] = useState(20)
  const [cube2H, setCube2H] = useState(2)
  const [cube2Density, setCube2Density] = useState(2500)
  const [cube3X, setCube3X] = useState(20)
  const [cube3Y, setCube3Y] = useState(20)
  const [cube3Z, setCube3Z] = useState(20)
  const [cube3H, setCube3H] = useState(2)
  const [cube3Density, setCube3Density] = useState(2500)
  const [cube4X, setCube4X] = useState(20)
  const [cube4Y, setCube4Y] = useState(20)
  const [cube4Z, setCube4Z] = useState(20)
  const [cube4H, setCube4H] = useState(2)
  const [cube4Density, setCube4Density] = useState(2500)

  const [spacingX, setSpacingX] = useState(80)
  const [spacingY, setSpacingY] = useState(80)
  const [cube1OffsetX, setCube1OffsetX] = useState(0)
  const [cube1OffsetY, setCube1OffsetY] = useState(0)
  const [cube2OffsetX, setCube2OffsetX] = useState(0)
  const [cube2OffsetY, setCube2OffsetY] = useState(0)
  const [cube3OffsetX, setCube3OffsetX] = useState(0)
  const [cube3OffsetY, setCube3OffsetY] = useState(0)
  const [cube4OffsetX, setCube4OffsetX] = useState(0)
  const [cube4OffsetY, setCube4OffsetY] = useState(0)

  // --- Faulted block ---
  const [faultedBlockX, setFaultedBlockX] = useState(100)
  const [faultedBlockY, setFaultedBlockY] = useState(100)
  const [faultedBlockZ, setFaultedBlockZ] = useState(100)
  const [faultedBlockFaultOffset, setFaultedBlockFaultOffset] = useState(20)
  const [faultedBlockH, setFaultedBlockH] = useState(2)
  const [faultedBlockDensity, setFaultedBlockDensity] = useState(2500)
  const [valleyMountainX, setValleyMountainX] = useState(400)
  const [valleyMountainY, setValleyMountainY] = useState(140)
  const [valleyMountainZ, setValleyMountainZ] = useState(90)
  const [valleyMountainH, setValleyMountainH] = useState(100)
  const [valleyMountainDensity, setValleyMountainDensity] = useState(2850)
  const [valleyMountainMountainDensity, setValleyMountainMountainDensity] = useState(2550)
  const [valleyMountainValleyDensity, setValleyMountainValleyDensity] = useState(2850)
  const [valleyMountainHeight, setValleyMountainHeight] = useState(50)
  const [valleyMountainDepth, setValleyMountainDepth] = useState(50)

  // --- Public hook API (consumed by `App` → gravity views) ---
  return {
    cubeX, setCubeX, cubeY, setCubeY, cubeZ, setCubeZ, cubeH, setCubeH, cubeDensity, setCubeDensity,
    cuboidX, setCuboidX, cuboidY, setCuboidY, cuboidZ, setCuboidZ, cuboidH, setCuboidH, cuboidDensity, setCuboidDensity,
    sphereRadius, setSphereRadius, sphereH, setSphereH, sphereDensity, setSphereDensity,
    ellipsoidA, setEllipsoidA, ellipsoidB, setEllipsoidB, ellipsoidC, setEllipsoidC, ellipsoidH, setEllipsoidH, ellipsoidDensity, setEllipsoidDensity,
    verticalCylinderRadius, setVerticalCylinderRadius, verticalCylinderHeight, setVerticalCylinderHeight, verticalCylinderH, setVerticalCylinderH, verticalCylinderDensity, setVerticalCylinderDensity,
    horizontalCylinderRadius, setHorizontalCylinderRadius, horizontalCylinderLength, setHorizontalCylinderLength, horizontalCylinderH, setHorizontalCylinderH, horizontalCylinderDensity, setHorizontalCylinderDensity,
    cube1X, setCube1X, cube1Y, setCube1Y, cube1Z, setCube1Z, cube1H, setCube1H, cube1Density, setCube1Density,
    cube2X, setCube2X, cube2Y, setCube2Y, cube2Z, setCube2Z, cube2H, setCube2H, cube2Density, setCube2Density,
    cube3X, setCube3X, cube3Y, setCube3Y, cube3Z, setCube3Z, cube3H, setCube3H, cube3Density, setCube3Density,
    cube4X, setCube4X, cube4Y, setCube4Y, cube4Z, setCube4Z, cube4H, setCube4H, cube4Density, setCube4Density,
    spacingX, setSpacingX, spacingY, setSpacingY,
    cube1OffsetX, setCube1OffsetX, cube1OffsetY, setCube1OffsetY,
    cube2OffsetX, setCube2OffsetX, cube2OffsetY, setCube2OffsetY,
    cube3OffsetX, setCube3OffsetX, cube3OffsetY, setCube3OffsetY,
    cube4OffsetX, setCube4OffsetX, cube4OffsetY, setCube4OffsetY,
    faultedBlockX, setFaultedBlockX, faultedBlockY, setFaultedBlockY, faultedBlockZ, setFaultedBlockZ, faultedBlockFaultOffset, setFaultedBlockFaultOffset, faultedBlockH, setFaultedBlockH, faultedBlockDensity, setFaultedBlockDensity,
    valleyMountainX, setValleyMountainX, valleyMountainY, setValleyMountainY, valleyMountainZ, setValleyMountainZ, valleyMountainH, setValleyMountainH, valleyMountainDensity, setValleyMountainDensity,
    valleyMountainMountainDensity, setValleyMountainMountainDensity, valleyMountainValleyDensity, setValleyMountainValleyDensity,
    valleyMountainHeight, setValleyMountainHeight, valleyMountainDepth, setValleyMountainDepth,
  }
}

