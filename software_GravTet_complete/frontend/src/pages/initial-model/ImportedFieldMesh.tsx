/**
 * Initial model gravity UI/logic: `ImportedFieldMesh.tsx`.
 */

import { useMemo } from 'react'
import * as THREE from 'three'
import type { ImportedField } from './initialModel/types'
import { bilinearZ, lerp1d } from './initialModel/math'
import { colormapRgb, type ImportedColormapId } from './initialModel/colormap'

type VertScale = {
  exaggeration: number
  zMean: number
  zMin: number
  zMax: number
}

type Props = {
  importedField: ImportedField
  importedVertScale: VertScale
  showImportedEdges: boolean
  importedColormap: ImportedColormapId
}

export function ImportedFieldMesh({ importedField, importedVertScale, showImportedEdges, importedColormap }: Props) {
  return useMemo(() => {
    const { xs, ys, zGrid, valueGrid } = importedField
    const ny = ys.length
    const nx = xs.length
    if (nx < 2 || ny < 2) return null

    const { exaggeration, zMean } = importedVertScale

    let minV = Infinity
    let maxV = -Infinity
    for (let iy = 0; iy < ny; iy++) {
      for (let ix = 0; ix < nx; ix++) {
        const v = valueGrid[iy][ix]
        if (!Number.isFinite(v)) continue
        minV = Math.min(minV, v)
        maxV = Math.max(maxV, v)
      }
    }
    const valueSpan = Number.isFinite(minV) && Number.isFinite(maxV) ? maxV - minV : 0
    const vSafe =
      valueSpan > 1e-12
        ? valueGrid.map((row) => row.map((v) => (Number.isFinite(v) ? v : (minV + maxV) / 2)))
        : null

    const zVis = (z: number) => zMean + (z - zMean) * exaggeration

    const nxOut = Math.min(120, Math.max(nx, (nx - 1) * 2 + 1))
    const nyOut = Math.min(120, Math.max(ny, (ny - 1) * 2 + 1))

    const vertexCount = nxOut * nyOut
    const gridIndices: number[] = []
    const vid = (ix: number, iy: number) => iy * nxOut + ix

    for (let iy = 0; iy < nyOut - 1; iy++) {
      for (let ix = 0; ix < nxOut - 1; ix++) {
        const a = vid(ix, iy)
        const b = vid(ix + 1, iy)
        const d = vid(ix, iy + 1)
        const c = vid(ix + 1, iy + 1)
        gridIndices.push(a, b, d)
        gridIndices.push(b, c, d)
      }
    }

    const positions = new Float32Array(vertexCount * 3)
    const colors = new Float32Array(vertexCount * 3)

    for (let iy = 0; iy < nyOut; iy++) {
      for (let ix = 0; ix < nxOut; ix++) {
        const i = vid(ix, iy)
        const fx = nxOut === 1 ? 0 : ix / (nxOut - 1)
        const fy = nyOut === 1 ? 0 : iy / (nyOut - 1)
        const px = fx * (nx - 1)
        const py = fy * (ny - 1)
        const x = lerp1d(xs, px)
        const y = lerp1d(ys, py)
        const zRaw = bilinearZ(zGrid, nx, ny, fx, fy)
        const zScaled = zVis(zRaw)
        positions[i * 3 + 0] = x
        positions[i * 3 + 1] = -zScaled
        positions[i * 3 + 2] = y

        let r = 0.52
        let gch = 0.52
        let b = 0.55
        if (valueSpan > 1e-12 && vSafe) {
          const v = bilinearZ(vSafe, nx, ny, fx, fy)
          if (Number.isFinite(v)) {
            const t = (v - minV) / valueSpan
            const base = colormapRgb(importedColormap, t)
            r = base.r
            gch = base.g
            b = base.b
          }
        }
        colors[i * 3 + 0] = r
        colors[i * 3 + 1] = gch
        colors[i * 3 + 2] = b
      }
    }

    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geom.setIndex(gridIndices)
    geom.computeVertexNormals()

    const gridLineIndices: number[] = []
    for (let iy = 0; iy < nyOut; iy++) {
      for (let ix = 0; ix < nxOut - 1; ix++) {
        gridLineIndices.push(vid(ix, iy), vid(ix + 1, iy))
      }
    }
    for (let ix = 0; ix < nxOut; ix++) {
      for (let iy = 0; iy < nyOut - 1; iy++) {
        gridLineIndices.push(vid(ix, iy), vid(ix, iy + 1))
      }
    }

    const gridLinesGeom =
      showImportedEdges && gridLineIndices.length > 0
        ? (() => {
            const g = new THREE.BufferGeometry()
            g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
            g.setIndex(gridLineIndices)
            return g
          })()
        : null

    return (
      <group>
        <mesh
          geometry={geom}
          renderOrder={0}
          material={
            new THREE.MeshStandardMaterial({
              vertexColors: true,
              flatShading: false,
              metalness: 0.06,
              roughness: 0.62,
              side: THREE.DoubleSide,
              polygonOffset: true,
              polygonOffsetFactor: 1,
              polygonOffsetUnits: 1,
            })
          }
        />
        {gridLinesGeom && (
          <lineSegments geometry={gridLinesGeom} renderOrder={10}>
            <lineBasicMaterial
              color="#000000"
              depthTest
              depthWrite={false}
              polygonOffset
              polygonOffsetFactor={-4}
              polygonOffsetUnits={-4}
            />
          </lineSegments>
        )}
      </group>
    )
  }, [importedField, importedVertScale, showImportedEdges, importedColormap])
}
