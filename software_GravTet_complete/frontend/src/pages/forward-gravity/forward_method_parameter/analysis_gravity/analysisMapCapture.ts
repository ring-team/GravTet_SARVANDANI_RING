/** Capture analysis / forward gravity map and composite axes + colorbar (no clipped Y ticks). */

import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { paintColorbarRainbowCanvas } from '../../lib/colorbarRainbow'

export type AnalysisExportImageFormat = 'png' | 'jpeg'

const HTML2CANVAS_OPTS_BASE = {
  backgroundColor: '#ffffff',
  scale: 2,
  logging: false,
  useCORS: true,
  allowTaint: true,
} as const

/** Applied only on the html2canvas clone so exports read clearly without resizing the live map. */
export const ANALYSIS_MAP_EXPORT_CLONE_CLASS = 'analysis-map-capture-export-clone'

function waitTwoFrames(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

function readColorbarLabels(root: HTMLElement): { min: string; mid: string; max: string } {
  const text = (sel: string) => (root.querySelector(sel)?.textContent || '').trim()
  return {
    min: text('.color-scale-min') || '0',
    mid: text('.color-scale-mid') || '',
    max: text('.color-scale-max') || '',
  }
}

type AxisTick = { text: string; pct: number }

function readAxisTicks(root: HTMLElement, labelSelector: string, posProp: 'top' | 'left'): AxisTick[] {
  return Array.from(root.querySelectorAll<HTMLElement>(`${labelSelector} .axis-label`)).map((el) => {
    const raw = el.style[posProp] || '0'
    const pct = Number.parseFloat(raw)
    return {
      text: (el.textContent || '').replace(/\u00a0/g, ' ').trim(),
      pct: Number.isFinite(pct) ? pct : 0,
    }
  })
}

function measureTextWidth(ctx: CanvasRenderingContext2D, text: string): number {
  return ctx.measureText(text).width
}

/**
 * Build export: [Y ticks | plot] / [spacer | X ticks] / [spacer | colorbar].
 * Y ticks are painted (not DOM-captured) so minus signs are never clipped.
 */
function compositeFullExport(
  plotCanvas: HTMLCanvasElement,
  yTicks: AxisTick[],
  xTicks: AxisTick[],
  colorLabels: { min: string; mid: string; max: string },
  fontScale = 1,
): HTMLCanvasElement {
  const scale = HTML2CANVAS_OPTS_BASE.scale
  const plotW = plotCanvas.width
  const plotH = plotCanvas.height
  // Export typography is relative to the plot, not browser/CSS pixels. This keeps
  // labels readable when a saved map is reduced into a multi-column paper figure.
  const tickFont = plotW * 0.075 * fontScale
  const titleFont = Math.min(plotW, plotH) * 0.085 * fontScale
  const colorFont = plotW * 0.075 * fontScale
  const gap = plotW * 0.018
  const padTop = Math.max(gap, tickFont * 0.6)
  const padBottom = gap
  const padRight = gap
  const gapPlotToX = gap
  const gapXToBar = gap
  const barH = plotW * 0.035
  const xTickH = tickFont * 1.3
  const yTickGap = gap

  // Metres are already specified by the axis titles. Omitting repeated units
  // leaves more room for numbers without reducing their font size.
  const axisText = (text: string) => text.replace(/\s*m$/, '')
  const probe = document.createElement('canvas').getContext('2d')
  if (!probe) return plotCanvas
  probe.font = `700 ${tickFont}px system-ui, -apple-system, Segoe UI, sans-serif`
  const maxYTickW = Math.max(0, ...yTicks.map((t) => measureTextWidth(probe, axisText(t.text))))
  const yColW = Math.ceil(maxYTickW)
  const padLeft = gap

  probe.font = `700 ${colorFont}px system-ui, -apple-system, Segoe UI, sans-serif`
  const minColorW = measureTextWidth(probe, colorLabels.min)
  const maxColorW = measureTextWidth(probe, colorLabels.max)
  const midColorW = measureTextWidth(probe, colorLabels.mid)
  const staggerColorEndpoints = minColorW + maxColorW + gap > plotW
  const showColorMid = Boolean(colorLabels.mid) && !staggerColorEndpoints &&
    minColorW + gap < (plotW - midColorW) / 2 &&
    maxColorW + gap < (plotW - midColorW) / 2
  const colorLabelH = gap + colorFont * 1.35 * (staggerColorEndpoints ? 2 : 1)

  const out = document.createElement('canvas')
  out.width = padLeft + yColW + yTickGap + plotW + padRight
  out.height =
    padTop + plotH + gapPlotToX + xTickH + gapXToBar + barH + colorLabelH + padBottom
  const ctx = out.getContext('2d')
  if (!ctx) return plotCanvas

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, out.width, out.height)

  const plotX = padLeft + yColW + yTickGap
  const plotY = padTop
  ctx.drawImage(plotCanvas, plotX, plotY)

  // Axis titles on the plot (plain white, no halo)
  ctx.fillStyle = '#ffffff'
  ctx.font = `700 ${titleFont}px system-ui, -apple-system, Segoe UI, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText('X (m)', plotX + plotW / 2, plotY + gap)

  // Vertical Y title (plain white)
  ctx.save()
  ctx.translate(plotX + plotW - titleFont * 0.7, plotY + plotH / 2)
  ctx.rotate(Math.PI / 2)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('Y (m)', 0, 0)
  ctx.restore()

  // Y tick labels — right-aligned in the left column (full text including "-")
  ctx.font = `700 ${tickFont}px system-ui, -apple-system, Segoe UI, sans-serif`
  ctx.fillStyle = '#000000'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  const yTickRight = padLeft + yColW
  // Keep endpoints and zero first; skip other ticks only if their labels collide.
  const visibleTicks = (ticks: AxisTick[], horizontal: boolean) => {
    const sorted = [...ticks].sort((a, b) => a.pct - b.pct)
    const priority = [sorted[0], sorted[sorted.length - 1],
      ...sorted.filter((t) => Number(axisText(t.text)) === 0), ...sorted]
    const accepted: { tick: AxisTick; start: number; end: number; center: number }[] = []
    const extent = horizontal ? plotW : plotH
    for (const tick of priority) {
      if (!tick || accepted.some((entry) => entry.tick === tick)) continue
      const size = horizontal ? measureTextWidth(ctx, axisText(tick.text)) : tickFont * 1.2
      const rawCenter = (tick.pct / 100) * extent
      const center = horizontal
        ? Math.max(size / 2, Math.min(extent - size / 2, rawCenter))
        : rawCenter
      const start = center - size / 2
      const end = center + size / 2
      if (accepted.every((entry) => end + gap <= entry.start || start >= entry.end + gap)) {
        accepted.push({ tick, start, end, center })
      }
    }
    return accepted
  }
  for (const { tick, center } of visibleTicks(yTicks, false)) {
    ctx.fillText(axisText(tick.text), yTickRight, plotY + center)
  }

  // Clamp endpoint labels inside the plot width so larger text cannot be cropped.
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  const xTickTop = plotY + plotH + gapPlotToX
  for (const { tick, center } of visibleTicks(xTicks, true)) {
    ctx.fillText(axisText(tick.text), plotX + center, xTickTop)
  }

  // Colorbar = plot / X-axis width
  const barX = plotX
  const barW = plotW
  const barY = xTickTop + xTickH + gapXToBar
  const strip = document.createElement('canvas')
  paintColorbarRainbowCanvas(
    strip,
    Math.max(8, Math.round(barW / scale)),
    Math.max(8, Math.round(barH / scale)),
  )
  ctx.drawImage(strip, barX, barY, barW, barH)
  ctx.strokeStyle = '#e5e7eb'
  ctx.lineWidth = Math.max(1, scale)
  ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1)

  ctx.font = `700 ${colorFont}px system-ui, -apple-system, Segoe UI, sans-serif`
  ctx.fillStyle = '#000000'
  ctx.textBaseline = 'top'
  const colorLabelY = barY + barH + gap
  ctx.textAlign = 'left'
  ctx.fillText(colorLabels.min, barX, colorLabelY)
  if (showColorMid) {
    ctx.textAlign = 'center'
    ctx.fillText(colorLabels.mid, barX + barW / 2, colorLabelY)
  }
  ctx.textAlign = 'right'
  ctx.fillText(colorLabels.max, barX + barW,
    colorLabelY + (staggerColorEndpoints ? colorFont * 1.35 : 0))

  return out
}

export async function captureElementToCanvas(el: HTMLElement): Promise<HTMLCanvasElement> {
  const colorLabels = readColorbarLabels(el)
  const yTicks = readAxisTicks(el, '.y-axis-labels', 'top')
  const xTicks = readAxisTicks(el, '.x-axis-labels', 'left')
  const plotEl =
    (el.querySelector('.map-container') as HTMLElement | null) ||
    (el.querySelector('.map-wrapper') as HTMLElement | null) ||
    el

  // Measure BEFORE any style unlock. Rectangular `.map-container` height comes from the
  // flex/grid parent; cells/canvas are position:absolute, so height:auto collapses to ~0
  // and the saved PNG only shows axes + colorbar.
  const liveRect = plotEl.getBoundingClientRect()
  const liveW = Math.max(1, Math.round(liveRect.width))
  const liveH = Math.max(1, Math.round(liveRect.height))

  type StyleSnap = {
    node: HTMLElement
    width: string
    height: string
    minWidth: string
    minHeight: string
    maxHeight: string
    overflow: string
  }
  const touched: StyleSnap[] = []
  const snap = (node: HTMLElement | null) => {
    if (!node) return
    touched.push({
      node,
      width: node.style.width,
      height: node.style.height,
      minWidth: node.style.minWidth,
      minHeight: node.style.minHeight,
      maxHeight: node.style.maxHeight,
      overflow: node.style.overflow,
    })
  }

  snap(el)
  snap(el.querySelector('.gravity-map') as HTMLElement | null)
  snap(el.querySelector('.map-wrapper') as HTMLElement | null)
  snap(plotEl)

  // Parents: allow overflow so nothing clips the plot during capture.
  for (const t of touched) {
    if (t.node === plotEl) continue
    t.node.style.maxHeight = 'none'
    t.node.style.overflow = 'visible'
  }

  // Freeze plot to live pixel size (square already has explicit size; rectangular needs this).
  plotEl.style.width = `${liveW}px`
  plotEl.style.height = `${liveH}px`
  plotEl.style.minWidth = `${liveW}px`
  plotEl.style.minHeight = `${liveH}px`
  plotEl.style.maxHeight = 'none'
  plotEl.style.overflow = 'hidden'

  await waitTwoFrames()

  try {
    const plotCanvas = await html2canvas(plotEl, {
      ...HTML2CANVAS_OPTS_BASE,
      width: liveW,
      height: liveH,
      windowWidth: liveW,
      windowHeight: liveH,
      onclone: (_document, clonedRoot) => {
        clonedRoot.classList.add(ANALYSIS_MAP_EXPORT_CLONE_CLASS)
        clonedRoot.style.width = `${liveW}px`
        clonedRoot.style.height = `${liveH}px`
        clonedRoot.style.minWidth = `${liveW}px`
        clonedRoot.style.minHeight = `${liveH}px`
        clonedRoot.style.overflow = 'hidden'
        clonedRoot.style.background = '#000000'
        // Titles are painted in composite — hide DOM titles inside the plot capture.
        clonedRoot
          .querySelectorAll<HTMLElement>(
            '.x-axis-title-top-inside, .y-axis-title-right, .y-axis-title-left',
          )
          .forEach((t) => {
            t.style.display = 'none'
          })
        // html2canvas often clones <canvas> blank — copy pixels from the live map canvas.
        const liveCanvases = plotEl.querySelectorAll('canvas')
        const cloneCanvases = clonedRoot.querySelectorAll('canvas')
        liveCanvases.forEach((live, i) => {
          const clone = cloneCanvases[i]
          if (!clone) return
          clone.width = live.width
          clone.height = live.height
          clone.style.width = '100%'
          clone.style.height = '100%'
          const ctx = clone.getContext('2d')
          if (ctx) ctx.drawImage(live, 0, 0)
        })
      },
    })

    if (plotCanvas.width < 8 || plotCanvas.height < 8) {
      throw new Error(
        `Map capture failed: plot canvas too small (${plotCanvas.width}×${plotCanvas.height}).`,
      )
    }

    // The composite is normally shown as a larger, standalone rectangular map.
    // Keep the publication-sized labels for all other synthetic models.
    const modelBase = el.dataset.exportModelType?.split(' - ')[0]
    const fontScale = modelBase === 'Valley-Mountain Model' ? 0.4 : 1
    return compositeFullExport(plotCanvas, yTicks, xTicks, colorLabels, fontScale)
  } finally {
    for (const t of touched) {
      t.node.style.width = t.width
      t.node.style.height = t.height
      t.node.style.minWidth = t.minWidth
      t.node.style.minHeight = t.minHeight
      t.node.style.maxHeight = t.maxHeight
      t.node.style.overflow = t.overflow
    }
  }
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export async function downloadElementAsRaster(
  el: HTMLElement,
  format: AnalysisExportImageFormat,
  baseNameWithoutExtension: string,
): Promise<void> {
  const canvas = await captureElementToCanvas(el)
  const dataUrl =
    format === 'jpeg' ? canvas.toDataURL('image/jpeg', 0.92) : canvas.toDataURL('image/png')
  const ext = format === 'jpeg' ? '.jpg' : '.png'
  downloadDataUrl(dataUrl, `${baseNameWithoutExtension}${ext}`)
}

export async function downloadElementAsPdf(el: HTMLElement, baseNameWithoutExtension: string): Promise<void> {
  const canvas = await captureElementToCanvas(el)
  const imgData = canvas.toDataURL('image/png')
  const orientation = canvas.width >= canvas.height ? 'l' : 'p'
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 28
  const maxW = pageW - margin * 2
  const maxH = pageH - margin * 2
  const scale = Math.min(maxW / canvas.width, maxH / canvas.height)
  const drawW = canvas.width * scale
  const drawH = canvas.height * scale
  const x = (pageW - drawW) / 2
  const y = (pageH - drawH) / 2
  pdf.addImage(imgData, 'PNG', x, y, drawW, drawH)
  pdf.save(`${baseNameWithoutExtension}.pdf`)
}

export async function downloadElementAsFormat(
  el: HTMLElement,
  format: 'png' | 'jpeg' | 'pdf',
  baseNameWithoutExtension: string,
): Promise<void> {
  if (format === 'pdf') {
    await downloadElementAsPdf(el, baseNameWithoutExtension)
  } else {
    await downloadElementAsRaster(el, format, baseNameWithoutExtension)
  }
}
