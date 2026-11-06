/** Capture the full app page (header + 3D view + parameters), with WebGL baked in. */

import html2canvas from 'html2canvas'
import type { RefObject } from 'react'
import { downloadDataUrl } from '../../forward-gravity/forward_method_parameter/analysis_gravity/analysisMapCapture'
import type { ModelViewCaptureHandle } from './ModelViewExportBridge'

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

export function findModel3DCanvas(viewRoot: HTMLElement | null): HTMLCanvasElement | null {
  if (!viewRoot) return null
  const canvas = viewRoot.querySelector('canvas')
  return canvas instanceof HTMLCanvasElement ? canvas : null
}

export async function captureModel3DViewCanvas(viewRoot: HTMLElement): Promise<HTMLCanvasElement> {
  await waitForNextFrame()
  const source = findModel3DCanvas(viewRoot)
  if (!source) {
    throw new Error('3D model canvas not found')
  }

  const out = document.createElement('canvas')
  out.width = source.width
  out.height = source.height
  const ctx = out.getContext('2d')
  if (!ctx) {
    throw new Error('Could not create export canvas')
  }
  ctx.fillStyle = '#f3f4f6'
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(source, 0, 0)
  return out
}

function findPageCaptureRoot(): HTMLElement {
  const root = document.querySelector('.app-layout')
  if (root instanceof HTMLElement) return root
  return document.body
}

/** html2canvas cannot read WebGL reliably — swap cloned 3D canvases for a raster snapshot. */
function replaceClonedWebGlCanvases(clonedRoot: HTMLElement, glDataUrl: string): void {
  const selector = '.cube-3d-view canvas, .model-3d-canvas canvas'
  clonedRoot.querySelectorAll(selector).forEach((node) => {
    const canvas = node as HTMLCanvasElement
    const img = clonedRoot.ownerDocument.createElement('img')
    img.src = glDataUrl
    img.alt = ''
    const w = canvas.style.width || (canvas.clientWidth ? `${canvas.clientWidth}px` : '100%')
    const h = canvas.style.height || (canvas.clientHeight ? `${canvas.clientHeight}px` : '100%')
    img.style.cssText = `width:${w};height:${h};display:block;object-fit:fill;max-width:100%;`
    canvas.replaceWith(img)
  })
}

export async function captureFullPageWithModelView(
  viewRoot: HTMLElement,
  exportHandleRef?: RefObject<ModelViewCaptureHandle | null>,
): Promise<HTMLCanvasElement> {
  const glCanvas =
    exportHandleRef?.current?.capture != null
      ? await exportHandleRef.current.capture()
      : await captureModel3DViewCanvas(viewRoot)
  const glDataUrl = glCanvas.toDataURL('image/png')

  await waitForNextFrame()
  const pageRoot = findPageCaptureRoot()
  return html2canvas(pageRoot, {
    backgroundColor: '#ffffff',
    scale: 2,
    logging: false,
    useCORS: true,
    allowTaint: true,
    scrollX: 0,
    scrollY: 0,
    windowWidth: document.documentElement.clientWidth,
    windowHeight: document.documentElement.clientHeight,
    onclone: (_doc, clonedRoot) => {
      replaceClonedWebGlCanvases(clonedRoot, glDataUrl)
    },
  })
}

export function modelViewExportStamp(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`
}

export function sanitizeModelViewFilenameBase(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug.length > 0 ? slug : 'synthetic-model'
}

export async function downloadModel3DViewPng(
  viewRoot: HTMLElement,
  filenameBase: string,
  exportHandleRef?: RefObject<ModelViewCaptureHandle | null>,
): Promise<void> {
  const canvas = await captureFullPageWithModelView(viewRoot, exportHandleRef)
  const base = sanitizeModelViewFilenameBase(filenameBase)
  downloadDataUrl(canvas.toDataURL('image/png'), `${base}-${modelViewExportStamp()}.png`)
}
