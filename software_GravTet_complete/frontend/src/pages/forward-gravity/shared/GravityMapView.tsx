/**
 * Shared gravity anomaly map (rainbow colormap, axes, color scale).
 * Used by Direct Newton and AMFM results in their own containers.
 *
 * Large observation grids (e.g. 400×400): one DOM node per cell would create
 * hundreds of thousands of elements and freeze/crash the browser. Above
 * MAX_DOM_MAP_CELLS we draw a single <canvas> instead.
 */
import { useEffect, useRef, useState } from 'react'
import { colormapRgb } from '../../initial-model/initialModel/colormap'
import { getRainbowRgb, paintColorbarRainbowCanvas } from '../lib/colorbarRainbow'
import ContourOverlay from './ContourOverlay'
import { formatScientificColorbarLabel } from '../lib/colorbarScientificFormat'

// Simple marching squares segment generator for contour overlay.
function marchingSquaresSegments(data: number[], nx: number, ny: number, threshold: number) {
  const segs: Array<[number, number, number, number]> = []
  // treat data as grid points with size nx x ny
  const at = (i: number, j: number) => data[i * ny + j]
  for (let i = 0; i < nx - 1; i++) {
    for (let j = 0; j < ny - 1; j++) {
      const v00 = at(i, j)
      const v10 = at(i + 1, j)
      const v11 = at(i + 1, j + 1)
      const v01 = at(i, j + 1)
      const i00 = v00 >= threshold ? 1 : 0
      const i10 = v10 >= threshold ? 1 : 0
      const i11 = v11 >= threshold ? 1 : 0
      const i01 = v01 >= threshold ? 1 : 0
      const code = i00 | (i10 << 1) | (i11 << 2) | (i01 << 3)
      // helper to interpolate along edge between p1(x1,y1,v1) and p2
      const interp = (x1: number, y1: number, v1: number, x2: number, y2: number, v2: number) => {
        const t = (threshold - v1) / (v2 - v1)
        return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)]
      }
      // coordinates in cell space
      const x0 = i
      const x1 = i + 1
      const y0 = j
      const y1c = j + 1
      switch (code) {
        case 1:
        case 14: {
          const pA = interp(x0, y0, v00, x1, y0, v10)
          const pB = interp(x0, y0, v00, x0, y1c, v01)
          segs.push([pA[0], pA[1], pB[0], pB[1]])
          break
        }
        case 2:
        case 13: {
          const pA = interp(x0, y0, v00, x1, y0, v10)
          const pB = interp(x1, y0, v10, x1, y1c, v11)
          segs.push([pA[0], pA[1], pB[0], pB[1]])
          break
        }
        case 3:
        case 12: {
          const pA = interp(x0, y0, v00, x0, y1c, v01)
          const pB = interp(x1, y0, v10, x1, y1c, v11)
          segs.push([pA[0], pA[1], pB[0], pB[1]])
          break
        }
        case 4:
        case 11: {
          const pA = interp(x1, y0, v10, x1, y1c, v11)
          const pB = interp(x0, y1c, v01, x1, y1c, v11)
          segs.push([pA[0], pA[1], pB[0], pB[1]])
          break
        }
        case 5: {
          const pA = interp(x0, y0, v00, x1, y0, v10)
          const pB = interp(x0, y1c, v01, x1, y1c, v11)
          segs.push([pA[0], pA[1], pB[0], pB[1]])
          break
        }
        case 6:
        case 9: {
          const pA = interp(x0, y0, v00, x1, y0, v10)
          const pB = interp(x0, y1c, v01, x1, y1c, v11)
          // ambiguous case, draw both diagonals small segments
          segs.push([pA[0], pA[1], pB[0], pB[1]])
          break
        }
        case 7:
        case 8: {
          const pA = interp(x0, y0, v00, x0, y1c, v01)
          const pB = interp(x0, y1c, v01, x1, y1c, v11)
          segs.push([pA[0], pA[1], pB[0], pB[1]])
          break
        }
        case 10: {
          const pA = interp(x0, y0, v00, x1, y0, v10)
          const pB = interp(x1, y0, v10, x1, y1c, v11)
          segs.push([pA[0], pA[1], pB[0], pB[1]])
          break
        }
        default:
          break
      }
    }
  }
  return segs
}

/** Above this many cells, use canvas instead of per-cell divs (React/DOM limit). */
export const MAX_DOM_MAP_CELLS = 4096

// --- Map extent (shared with forward-gravity and Initial Model) ---

export interface SurfaceBounds {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
  tickStep?: number
}

/** True when observation window is square (equal X/Y spans). */
export function isSquareSurfaceBounds(bounds: SurfaceBounds, tol = 1e-6): boolean {
  const xSpan = Math.abs(bounds.xMax - bounds.xMin)
  const ySpan = Math.abs(bounds.yMax - bounds.yMin)
  const scale = Math.max(xSpan, ySpan, 1)
  return Math.abs(xSpan - ySpan) <= tol * scale
}

/**
 * Square map panel only for Cube with equal horizontal sides, or Sphere.
 * Do not infer from bounds alone (other shapes can have near-equal framing).
 */
export function shouldForceSquareGravityMap(
  modelType: string | null | undefined,
  cubeX?: number,
  cubeY?: number,
): boolean {
  const base = (modelType || '').split(' - ')[0]
  if (base === 'Sphere') return true
  if (base !== 'Cube') return false
  const x = cubeX ?? 100
  const y = cubeY ?? 100
  return Math.abs(x - y) <= 1e-9 * Math.max(x, y, 1)
}

// --- Shared non-rainbow map styling for all grid sizes ---

function getRainbowColor(normalized: number): string {
  const t = Math.max(0, Math.min(1, normalized))
  const c = colormapRgb('cividis', t)
  return `rgb(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)})`
}

/**
 * Horizontal rainbow strip for the colorbar. Uses a canvas instead of a CSS
 * `linear-gradient` so html2canvas / raster exports do not show a spurious extra
 * band (often blue) on the right edge of the scale.
 */
function ColorbarRainbowCanvas() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return

    const paint = () => {
      const rect = wrap.getBoundingClientRect()
      const cssW = Math.max(8, Math.round(rect.width))
      const cssH = Math.max(8, Math.round(rect.height))
      if (cssW < 2) return
      paintColorbarRainbowCanvas(canvas, cssW, cssH)
    }

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(paint)
    })
    ro.observe(wrap)
    requestAnimationFrame(paint)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={wrapRef} className="scale-gradient">
      <canvas ref={canvasRef} className="scale-gradient-canvas" aria-hidden />
    </div>
  )
}

// --- Large grids: single canvas (avoids per-cell DOM) ---

function GravityMapCanvas({
  data,
  numX,
  numY,
  min,
  max,
  colorScale,
}: {
  data: number[]
  numX: number
  numY: number
  min: number
  max: number
  colorScale: 'linear' | 'log'
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const range = max - min
  const canUseLog = colorScale === 'log' && max > 0
  const logFloor = Math.max(min > 0 ? min : max * 1e-6, 1e-12)
  const logMin = Math.log10(logFloor)
  const logMax = Math.log10(Math.max(max, logFloor * 10))
  const logRange = logMax - logMin

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || numX < 1 || numY < 1) return

    const expected = numX * numY
    if (data.length < expected) return

    const container = canvas.parentElement
    if (!container) return

    const paint = () => {
      const rect = container.getBoundingClientRect()
      const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
      const wCss = Math.max(1, Math.floor(rect.width))
      const hCss = Math.max(1, Math.floor(rect.height))
      const pixelW = Math.max(numX, Math.min(4096, Math.floor(wCss * dpr)))
      const pixelH = Math.max(numY, Math.min(4096, Math.floor(hCss * dpr)))

      const img = new ImageData(numX, numY)
      const pixels = img.data

      for (let i = 0; i < numX; i++) {
        for (let j = 0; j < numY; j++) {
          const v = data[i * numY + j]
          const normalized = canUseLog
            ? (() => {
                const clamped = Math.max(v, logFloor)
                return logRange > 0 ? (Math.log10(clamped) - logMin) / logRange : 0.5
              })()
            : (range > 0 ? (v - min) / range : 0.5)
          const [r, g, b] = getRainbowRgb(normalized)
          const o = (j * numX + i) * 4
          pixels[o] = r
          pixels[o + 1] = g
          pixels[o + 2] = b
          pixels[o + 3] = 255
        }
      }

      const small = document.createElement('canvas')
      small.width = numX
      small.height = numY
      const sctx = small.getContext('2d', { alpha: false })
      if (!sctx) return
      sctx.putImageData(img, 0, 0)

      canvas.width = pixelW
      canvas.height = pixelH
      const ctx = canvas.getContext('2d', { alpha: false })
      if (!ctx) return
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(small, 0, 0, numX, numY, 0, 0, pixelW, pixelH)
    }

    paint()
    const ro = new ResizeObserver(() => {
      paint()
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [data, numX, numY, min, max, range, canUseLog, logFloor, logMin, logRange])

  return (
    <canvas
      ref={canvasRef}
      className="gravity-map-canvas"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        imageRendering: 'pixelated',
      }}
      aria-label={`Gravity map ${numX} by ${numY} cells`}
    />
  )
}

// --- Main export: axes + DOM cells or canvas + color bar ---

export interface GravityMapViewProps {
  data: number[]
  numX: number
  numY: number
  min: number
  max: number
  surfaceBounds: SurfaceBounds
  calculationTime: number | null
  title?: string
  colorBarDecimals?: number
  /** Digits after the decimal point in the mantissa when ``colorBarScientific`` (e.g. ``3`` → ``1.875 × 10⁻³``). */
  colorBarExpDigits?: number
  colorBarScientific?: boolean
  colorBarUnit?: string
  colorScale?: 'linear' | 'log'
  /** Square plot panel — only Cube (equal X/Y) or Sphere. */
  forceSquareMap?: boolean
}

export function GravityMapView({
  data,
  numX,
  numY,
  min,
  max,
  surfaceBounds,
  calculationTime,
  title = 'Gravity Anomaly Map (mGal)',
  colorBarDecimals = 2,
  colorBarExpDigits = 3,
  colorBarScientific = false,
  colorBarUnit = 'mGal',
  colorScale = 'linear',
  forceSquareMap = false,
}: GravityMapViewProps) {
  const range = max - min
  const canUseLog = colorScale === 'log' && max > 0
  const logFloor = Math.max(min > 0 ? min : max * 1e-6, 1e-12)
  const logMin = Math.log10(logFloor)
  const logMax = Math.log10(Math.max(max, logFloor * 10))
  const logRange = logMax - logMin
  // Use standard min/max normalization for absolute gravity maps.
  const vmin = min
  const vmax = max
  const vRange = vmax - vmin
  const cellCount = numX * numY
  const useCanvas = cellCount > MAX_DOM_MAP_CELLS
  const cellWidth = 100 / numX
  const cellHeight = 100 / numY
  const tickStep = surfaceBounds.tickStep ?? Math.max(1, Math.min(
    Math.abs(surfaceBounds.xMax - surfaceBounds.xMin),
    Math.abs(surfaceBounds.yMax - surfaceBounds.yMin)
  ) / 5)

  const xTicks: { value: number; position: number }[] = []
  const yTicks: { value: number; position: number }[] = []

  const addTicks = (
    minVal: number,
    maxVal: number,
    target: { value: number; position: number }[],
    /** When true, max is at top (matches map cells: row 0 = yMax). */
    topIsMax = false,
  ) => {
    const r = maxVal - minVal
    const count = Math.max(3, Math.min(11, Math.round(Math.abs(r) / tickStep) + 1))
    const ticks: number[] = []
    for (let i = 0; i < count; i++) {
      ticks.push(minVal + (i / (count - 1)) * r)
    }
    if (minVal <= 0 && maxVal >= 0 && !ticks.some(t => Math.abs(t) < 0.01)) {
      ticks.push(0)
      ticks.sort((a, b) => a - b)
    }
    ticks.forEach((value) => {
      const along = r !== 0 ? (value - minVal) / r : 0.5
      const position = (topIsMax ? 1 - along : along) * 100
      target.push({ value, position })
    })
  }
  addTicks(surfaceBounds.xMin, surfaceBounds.xMax, xTicks)
  addTicks(surfaceBounds.yMin, surfaceBounds.yMax, yTicks, true)

  const clampPercent = (p: number, minP = 2, maxP = 98) => Math.max(minP, Math.min(maxP, p))

  const timeDisplay = calculationTime !== null
    ? ` (${calculationTime < 1000 ? calculationTime.toFixed(0) + ' ms' : (calculationTime / 1000).toFixed(2) + ' s'})`
    : ''
  const showTitle = title.length > 0
  const formatColorScaleLabel = (v: number) => {
    if (!colorBarScientific) {
      return Number(v.toFixed(colorBarDecimals)).toFixed(colorBarDecimals)
    }
    return formatScientificColorbarLabel(v, colorBarExpDigits)
  }
  const midValue = (min + max) / 2
  // Only Cube (equal X/Y) / Sphere — never auto-square from bounds alone.
  const squareMap = forceSquareMap
  const mapFrameRef = useRef<HTMLDivElement>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const [squareSidePx, setSquareSidePx] = useState<number | null>(null)
  /** Live colorbar width = exact plot / X-axis width (square and rectangular). */
  const [plotWidthPx, setPlotWidthPx] = useState<number | null>(null)
  const yLabelColPx = 104

  useEffect(() => {
    if (!squareMap) {
      setSquareSidePx(null)
      return
    }
    const frame = mapFrameRef.current
    if (!frame) return
    // Leave room under the square plot for X tick labels (they were clipped when the
    // square consumed the full frame height inside overflow:hidden).
    const xTickReservePx = 30
    const update = () => {
      const w = frame.clientWidth
      const h = frame.clientHeight
      if (w < 2 || h < 2) return
      const usableW = Math.max(1, w - yLabelColPx - 12)
      const usableH = Math.max(1, h - xTickReservePx)
      setSquareSidePx(Math.max(1, Math.floor(Math.min(usableW, usableH))))
    }
    update()
    const ro = new ResizeObserver(() => update())
    ro.observe(frame)
    const host = frame.parentElement
    if (host) ro.observe(host)
    return () => ro.disconnect()
  }, [squareMap])

  useEffect(() => {
    const el = mapContainerRef.current
    if (!el) return
    const update = () => {
      const w = Math.round(el.getBoundingClientRect().width)
      if (w > 1) setPlotWidthPx(w)
    }
    update()
    const ro = new ResizeObserver(() => update())
    ro.observe(el)
    return () => ro.disconnect()
  }, [squareMap, squareSidePx, numX, numY])

  const mapPlot = (
    <div
      ref={mapContainerRef}
      className={`map-container${squareMap ? ' map-container--square' : ''}`}
      style={
        squareMap && squareSidePx != null
          ? { width: squareSidePx, height: squareSidePx }
          : undefined
      }
    >
      <div className="axis-title x-axis-title-top-inside">X (m)</div>
      {useCanvas ? (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <GravityMapCanvas data={data} numX={numX} numY={numY} min={vmin} max={vmax} colorScale={colorScale} />
          <ContourOverlay data={data} numX={numX} numY={numY} min={vmin} max={vmax} levels={12} />
        </div>
      ) : (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          {data.map((value, index) => {
          const i = Math.floor(index / numY)
          const j = index % numY
          const xCoord = numX > 1
            ? surfaceBounds.xMin + (i / (numX - 1)) * (surfaceBounds.xMax - surfaceBounds.xMin)
            : surfaceBounds.xMin
          const yCoord = numY > 1
            ? surfaceBounds.yMax - (j / (numY - 1)) * (surfaceBounds.yMax - surfaceBounds.yMin)
            : surfaceBounds.yMax
          const normalized = canUseLog
            ? (() => {
                const clamped = Math.max(value, logFloor)
                return logRange > 0 ? (Math.log10(clamped) - logMin) / logRange : 0.5
              })()
            : (vRange > 0 ? (value - vmin) / vRange : 0.5)
          const color = getRainbowColor(normalized)
          return (
            <div
              key={index}
              className="map-cell"
              style={{
                left: `${i * cellWidth}%`,
                top: `${j * cellHeight}%`,
                width: `calc(${cellWidth}% + 1px)`,
                height: `calc(${cellHeight}% + 1px)`,
                backgroundColor: color,
              }}
              title={`X: ${xCoord.toFixed(1)} m, Y: ${yCoord.toFixed(1)} m, Value: ${value.toFixed(2)} mGal`}
            />
          )
        })}
          <ContourOverlay data={data} numX={numX} numY={numY} min={vmin} max={vmax} levels={12} />
        </div>
      )}
      <div className="axis-title y-axis-title-right">Y (m)</div>
    </div>
  )

  /** Colorbar strip width = plot / X-axis width (square: explicit px; rectangular: CSS 100% of plot column). */
  const colorBarWidthPx = squareMap ? (squareSidePx ?? plotWidthPx) : null

  const colorBar = (
    <div
      className="color-scale"
      style={
        colorBarWidthPx != null
          ? {
              width: colorBarWidthPx,
              maxWidth: colorBarWidthPx,
              flex: `0 0 ${colorBarWidthPx}px`,
            }
          : undefined
      }
    >
      <ColorbarRainbowCanvas />
      <span className="color-scale-min">{formatColorScaleLabel(min)}{colorBarUnit && colorBarUnit !== '%' ? ` ${colorBarUnit}` : ''}</span>
      <span className="color-scale-mid">{formatColorScaleLabel(midValue)}{colorBarUnit && colorBarUnit !== '%' ? ` ${colorBarUnit}` : ''}</span>
      <span className="color-scale-max">{formatColorScaleLabel(max)}{colorBarUnit ? ` ${colorBarUnit}` : ''}</span>
    </div>
  )

  return (
    <div className={`gravity-map${squareMap ? ' gravity-map--square' : ''}`}>
      {showTitle && <h3>{title}{timeDisplay}</h3>}
      {squareMap ? (
        <>
          <div className="map-wrapper map-wrapper--square" ref={mapFrameRef}>
            <div className="map-square-cluster">
              <div
                className="y-axis-labels"
                style={squareSidePx != null ? { height: squareSidePx, width: yLabelColPx } : { width: yLabelColPx }}
              >
                {yTicks.map((tick, idx) => (
                  <span key={idx} className="axis-label" style={{ top: `${clampPercent(tick.position, 6, 94)}%` }}>
                    {tick.value.toFixed(0)}&nbsp;m
                  </span>
                ))}
              </div>
              <div className="map-square-column">
                {mapPlot}
                <div
                  className="x-axis-labels"
                  style={squareSidePx != null ? { width: squareSidePx } : undefined}
                >
                  {xTicks.map((tick, idx) => (
                    <span key={idx} className="axis-label" style={{ left: `${clampPercent(tick.position, 4, 96)}%` }}>
                      {tick.value.toFixed(0)}&nbsp;m
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* Same row geometry as the plot cluster: Y-spacer | colorbar (= X-axis width), centered. */}
          <div className="color-scale-wrapper color-scale-wrapper--square">
            <div className="color-scale-square-align">
              <div
                className="color-scale-spacer"
                style={{ width: yLabelColPx, flex: `0 0 ${yLabelColPx}px` }}
                aria-hidden
              />
              {colorBar}
            </div>
          </div>
        </>
      ) : (
        <div className="map-wrapper">
          <div className="y-axis-labels">
            {yTicks.map((tick, idx) => (
              <span key={idx} className="axis-label" style={{ top: `${clampPercent(tick.position, 6, 94)}%` }}>
                {tick.value.toFixed(0)}&nbsp;m
              </span>
            ))}
          </div>
          <div className="map-square-frame">
            {mapPlot}
          </div>
          <div className="axis-spacer axis-spacer--xticks" />
          <div className="x-axis-labels">
            {xTicks.map((tick, idx) => (
              <span key={idx} className="axis-label" style={{ left: `${clampPercent(tick.position, 4, 96)}%` }}>
                {tick.value.toFixed(0)}&nbsp;m
              </span>
            ))}
          </div>
          <div className="axis-spacer axis-spacer--colorbar" />
          {colorBar}
        </div>
      )}
    </div>
  )
}
