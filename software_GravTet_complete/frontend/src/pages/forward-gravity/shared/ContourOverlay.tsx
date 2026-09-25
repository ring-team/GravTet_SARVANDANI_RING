import React, { useEffect, useRef } from 'react'

function marchingSquaresSegments(data: number[], nx: number, ny: number, threshold: number) {
  const segs: Array<[number, number, number, number]> = []
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
      const interp = (x1: number, y1: number, v1: number, x2: number, y2: number, v2: number) => {
        const den = v2 - v1
        const t = den === 0 ? 0.5 : (threshold - v1) / den
        return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)]
      }
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

export default function ContourOverlay({ data, numX, numY, min, max, levels = 12 }: {
  data: number[]
  numX: number
  numY: number
  min: number
  max: number
  levels?: number
}) {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return

    const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)

    const render = () => {
      const rect = parent.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (!data || data.length === 0) return

      ctx.save()
      ctx.scale(dpr, dpr)
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(20,20,20,0.7)'

      const drawSegments = (segs: Array<[number, number, number, number]>) => {
        ctx.beginPath()
        for (const s of segs) {
          const [x1, y1, x2, y2] = s
          const px1 = (x1 / numX) * rect.width
          const py1 = (y1 / numY) * rect.height
          const px2 = (x2 / numX) * rect.width
          const py2 = (y2 / numY) * rect.height
          ctx.moveTo(px1, py1)
          ctx.lineTo(px2, py2)
        }
        ctx.stroke()
      }

      for (let k = 1; k <= levels; k++) {
        const threshold = min + (k / (levels + 1)) * (max - min)
        const segs = marchingSquaresSegments(data, numX, numY, threshold)
        drawSegments(segs)
      }

      ctx.restore()
    }

    render()

    const ro = new ResizeObserver(() => {
      render()
    })
    ro.observe(parent)
    return () => ro.disconnect()
  }, [data, numX, numY, min, max, levels])

  return (
    <canvas
      ref={ref}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', width: '100%', height: '100%' }}
      aria-hidden
    />
  )
}
