/**
 * Four-cube compound wireframe: four axis-aligned boxes with independent sizes for the multi-body preview.
 *
 * Emits `BufferGeometry` line segments for the “four cubes” synthetic model type.
 */
import * as THREE from 'three'
import type { CubeWireStyle } from '../default_data/defaultSources'
import { createCubeWireframe } from './cubeMesh'

export function createFourCubesWireframe(
  cube1X: number,
  cube1Y: number,
  cube1Z: number,
  cube1H: number,
  cube2X: number,
  cube2Y: number,
  cube2Z: number,
  cube2H: number,
  cube3X: number,
  cube3Y: number,
  cube3Z: number,
  cube3H: number,
  cube4X: number,
  cube4Y: number,
  cube4Z: number,
  cube4H: number,
  spacingX: number,
  spacingY: number,
  cube1OffsetX: number,
  cube1OffsetY: number,
  cube2OffsetX: number,
  cube2OffsetY: number,
  cube3OffsetX: number,
  cube3OffsetY: number,
  cube4OffsetX: number,
  cube4OffsetY: number,
  counts: { numSourcesX?: number; numSourcesY?: number; numSourcesZ?: number },
  wireStyle: CubeWireStyle,
  colorTsWireframe = false
): THREE.BufferGeometry {
  const positionsOut: number[] = []
  const indicesOut: number[] = []
  const colorsOut: number[] = []
  let indexOffset = 0

  const appendGeometryTranslated = (
    geom: THREE.BufferGeometry,
    tx: number,
    ty: number,
    tz: number
  ) => {
    const posAttr = geom.getAttribute('position') as THREE.BufferAttribute | undefined
    if (!posAttr) return

    for (let i = 0; i < posAttr.count; i++) {
      positionsOut.push(
        posAttr.getX(i) + tx,
        posAttr.getY(i) + ty,
        posAttr.getZ(i) + tz
      )
    }

    const colorAttr = geom.getAttribute('color') as THREE.BufferAttribute | undefined
    if (colorAttr) {
      for (let i = 0; i < colorAttr.count; i++) {
        colorsOut.push(colorAttr.getX(i), colorAttr.getY(i), colorAttr.getZ(i))
      }
    }

    const idxAttr = geom.getIndex()
    if (idxAttr) {
      for (let i = 0; i < idxAttr.count; i++) {
        indicesOut.push(idxAttr.getX(i) + indexOffset)
      }
    } else {
      for (let i = 0; i < posAttr.count; i += 2) {
        indicesOut.push(indexOffset + i, indexOffset + i + 1)
      }
    }
    indexOffset += posAttr.count
  }

  const cubePositions: [number, number, number][] = [
    [-spacingX / 2 + cube1OffsetX, 0, -spacingY / 2 + cube1OffsetY],
    [spacingX / 2 + cube2OffsetX, 0, -spacingY / 2 + cube2OffsetY],
    [-spacingX / 2 + cube3OffsetX, 0, spacingY / 2 + cube3OffsetY],
    [spacingX / 2 + cube4OffsetX, 0, spacingY / 2 + cube4OffsetY],
  ]
  const cubeParams = [
    { x: cube1X, y: cube1Y, z: cube1Z, h: cube1H },
    { x: cube2X, y: cube2Y, z: cube2Z, h: cube2H },
    { x: cube3X, y: cube3Y, z: cube3Z, h: cube3H },
    { x: cube4X, y: cube4Y, z: cube4Z, h: cube4H },
  ]

  for (let cubeIdx = 0; cubeIdx < 4; cubeIdx++) {
    const pos = cubePositions[cubeIdx]
    const params = cubeParams[cubeIdx]
    const x = params.x
    const y = params.y
    const z = params.z
    const h = params.h
    const centerY = -h - z / 2

    const singleCubeGeometry = createCubeWireframe(
      x,
      y,
      z,
      counts,
      wireStyle,
      colorTsWireframe
    )
    appendGeometryTranslated(singleCubeGeometry, pos[0], centerY, pos[2])
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positionsOut, 3))
  geometry.setIndex(indicesOut)
  if (colorsOut.length === positionsOut.length) {
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colorsOut, 3))
  }
  return geometry
}
