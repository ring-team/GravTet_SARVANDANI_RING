/**
 * Initial-model gravity helpers: `colormap.ts`.
 */

import { clamp, lerp } from './math'
import { interpolateCividis } from 'd3-scale-chromatic'
import { rgb as d3rgb } from 'd3-color'

/** HSV → RGB, h ∈ [0, 1] (one turn), s,v ∈ [0, 1]. */
function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const hh = ((h % 1) + 1) % 1
  const i = Math.floor(hh * 6)
  const f = hh * 6 - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  switch (i) {
    case 0:
      return { r: v, g: t, b: p }
    case 1:
      return { r: q, g: v, b: p }
    case 2:
      return { r: p, g: v, b: t }
    case 3:
      return { r: p, g: q, b: v }
    case 4:
      return { r: t, g: p, b: v }
    default:
      return { r: v, g: p, b: q }
  }
}

function hsvColor(t: number): { r: number; g: number; b: number } {
  const x = clamp(t, 0, 1)
  const h = (1 - x) * (2 / 3)
  return hsvToRgb(h, 1, 1)
}

function hotColor(t: number): { r: number; g: number; b: number } {
  const x = clamp(t, 0, 1)
  return {
    r: clamp(x * 2.5, 0, 1),
    g: clamp((x - 0.35) * 2.2, 0, 1),
    b: clamp((x - 0.65) * 3.5, 0, 1),
  }
}

function coolColor(t: number): { r: number; g: number; b: number } {
  const x = clamp(t, 0, 1)
  return { r: x, g: 1 - x, b: 1 }
}

function grayColor(t: number): { r: number; g: number; b: number } {
  const x = clamp(t, 0, 1)
  return { r: x, g: x, b: x }
}

// Use the canonical Cividis interpolator for accurate color mapping
function cividisColor(t: number): { r: number; g: number; b: number } {
  const x = Math.max(0, Math.min(1, t))
  const css = interpolateCividis(x) // returns a CSS color string like "rgb(r,g,b)"
  const c = d3rgb(css)
  return { r: (c.r ?? 0) / 255, g: (c.g ?? 0) / 255, b: (c.b ?? 0) / 255 }
}

export type ImportedColormapId = 'hsv' | 'hot' | 'cool' | 'gray' | 'cividis'

export function colormapRgb(id: ImportedColormapId, t: number): { r: number; g: number; b: number } {
  switch (id) {
    case 'hsv':
      return hsvColor(t)
    case 'hot':
      return hotColor(t)
    case 'cool':
      return coolColor(t)
    case 'cividis':
      return cividisColor(t)
    case 'gray':
      return grayColor(t)
    default:
      return cividisColor(t)
  }
}

export const IMPORTED_COLORMAP_OPTIONS: { id: ImportedColormapId; label: string }[] = [
  { id: 'hsv', label: 'HSV' },
  { id: 'hot', label: 'Hot' },
  { id: 'cool', label: 'Cool' },
  { id: 'gray', label: 'Gray' },
  { id: 'cividis', label: 'Cividis' },
]

export function rgbCss(c: { r: number; g: number; b: number }): string {
  return `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`
}

export function anomalyTickCssColor(cmap: ImportedColormapId, high: boolean): string {
  const { r, g, b } = colormapRgb(cmap, high ? 1 : 0)
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  if (lum < 0.22) return high ? '#fca5a5' : '#93c5fd'
  return rgbCss({ r, g, b })
}
