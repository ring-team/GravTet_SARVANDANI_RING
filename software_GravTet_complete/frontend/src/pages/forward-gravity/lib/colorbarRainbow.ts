/** Color mapping used by GravityMapView and export capture. */
import { colormapRgb } from '../../initial-model/initialModel/colormap'

/** Normalized position of pure yellow (kept for compatibility). */
export const RAINBOW_YELLOW_NORMALIZED = 0.75

/** Return RGB (0-255) using the `cividis` colormap for accessibility. */
export function getRainbowRgb(normalized: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, normalized))
  const c = colormapRgb('cividis', t)
  return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)]
}

export function paintColorbarRainbowCanvas(canvas: HTMLCanvasElement, cssW: number, cssH: number): void {
  const width = Math.max(8, Math.round(cssW))
  const height = Math.max(8, Math.round(cssH))
  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
  const bw = Math.max(2, Math.floor(width * dpr))
  const bh = Math.max(2, Math.floor(height * dpr))
  canvas.width = bw
  canvas.height = bh
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  for (let x = 0; x < bw; x++) {
    const t = bw <= 1 ? 0.5 : x / (bw - 1)
    const [r, g, b] = getRainbowRgb(t)
    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.fillRect(x, 0, 1, bh)
  }
}
