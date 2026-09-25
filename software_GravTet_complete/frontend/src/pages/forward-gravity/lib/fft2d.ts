/**
 * Minimal 2D FFT with zero-padding (radix-2) for vertical derivative and tilt.
 * Grid is padded to next power of 2; output is cropped back to original size.
 */

// --- Radix-2 FFT (internal) ---

function nextPow2(n: number): number {
  let p = 1
  while (p < n) p *= 2
  return p
}

/** In-place 1D complex FFT (radix-2). re and im are length N (power of 2). */
function fft1d(re: Float64Array, im: Float64Array, N: number, inverse: boolean): void {
  const sign = inverse ? 1 : -1
  let j = 0
  for (let i = 0; i < N - 1; i++) {
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t
      t = im[i]; im[i] = im[j]; im[j] = t
    }
    let k = N >> 1
    while (j >= k) { j -= k; k >>= 1 }
    j += k
  }
  let len = 2
  while (len <= N) {
    const half = len >> 1
    const angle = (sign * 2 * Math.PI) / len
    const wlenRe = Math.cos(angle)
    const wlenIm = Math.sin(angle)
    for (let i = 0; i < N; i += len) {
      let wRe = 1, wIm = 0
      for (let j = 0; j < half; j++) {
        const uRe = re[i + j], uIm = im[i + j]
        const vRe = re[i + j + half] * wRe - im[i + j + half] * wIm
        const vIm = re[i + j + half] * wIm + im[i + j + half] * wRe
        re[i + j] = uRe + vRe
        im[i + j] = uIm + vIm
        re[i + j + half] = uRe - vRe
        im[i + j + half] = uIm - vIm
        const wReNew = wRe * wlenRe - wIm * wlenIm
        wIm = wRe * wlenIm + wIm * wlenRe
        wRe = wReNew
      }
    }
    len <<= 1
  }
  if (inverse) {
    for (let i = 0; i < N; i++) {
      re[i] /= N
      im[i] /= N
    }
  }
}

/** 2D FFT (in-place on re, im; Nx, Ny must be powers of 2). */
function fft2d(re: Float64Array, im: Float64Array, Nx: number, Ny: number, inverse: boolean): void {
  const tmpRe = new Float64Array(Math.max(Nx, Ny))
  const tmpIm = new Float64Array(Math.max(Nx, Ny))
  for (let j = 0; j < Ny; j++) {
    for (let i = 0; i < Nx; i++) {
      tmpRe[i] = re[i * Ny + j]
      tmpIm[i] = im[i * Ny + j]
    }
    fft1d(tmpRe, tmpIm, Nx, inverse)
    for (let i = 0; i < Nx; i++) {
      re[i * Ny + j] = tmpRe[i]
      im[i * Ny + j] = tmpIm[i]
    }
  }
  for (let i = 0; i < Nx; i++) {
    for (let j = 0; j < Ny; j++) {
      tmpRe[j] = re[i * Ny + j]
      tmpIm[j] = im[i * Ny + j]
    }
    fft1d(tmpRe, tmpIm, Ny, inverse)
    for (let j = 0; j < Ny; j++) {
      re[i * Ny + j] = tmpRe[j]
      im[i * Ny + j] = tmpIm[j]
    }
  }
}

// --- Exported potential-field transforms (FFT domain) ---

/**
 * Vertical derivative ∂g/∂z from 2D gravity grid (FFT approximation).
 * For potential fields: ∂g/∂z in Fourier domain = |k| * G(k).
 * Grid is padded to next power of 2, then cropped to original size.
 */
export function verticalDerivative2D(
  data: number[],
  numX: number,
  numY: number
): number[] {
  if (numX < 2 || numY < 2 || data.length !== numX * numY) return data.slice()
  const Nx = nextPow2(numX)
  const Ny = nextPow2(numY)
  const re = new Float64Array(Nx * Ny)
  const im = new Float64Array(Nx * Ny)
  for (let i = 0; i < numX; i++) {
    for (let j = 0; j < numY; j++) {
      re[i * Ny + j] = data[i * numY + j]
    }
  }
  fft2d(re, im, Nx, Ny, false)
  const dx = 1, dy = 1
  for (let ii = 0; ii < Nx; ii++) {
    const kx = ii <= Nx / 2 ? (2 * Math.PI * ii) / (Nx * dx) : (2 * Math.PI * (ii - Nx)) / (Nx * dx)
    for (let jj = 0; jj < Ny; jj++) {
      const ky = jj <= Ny / 2 ? (2 * Math.PI * jj) / (Ny * dy) : (2 * Math.PI * (jj - Ny)) / (Ny * dy)
      const k = Math.sqrt(kx * kx + ky * ky) || 1e-10
      const idx = ii * Ny + jj
      const gr = re[idx], gi = im[idx]
      re[idx] = k * gr
      im[idx] = k * gi
    }
  }
  fft2d(re, im, Nx, Ny, true)
  const out: number[] = new Array(data.length)
  for (let i = 0; i < numX; i++) {
    for (let j = 0; j < numY; j++) {
      out[i * numY + j] = re[i * Ny + j]
    }
  }
  return out
}

/**
 * Upward continuation: compute gravity at a higher level (z + h).
 * In Fourier domain: G(k, z+h) = G(k, z) * exp(-|k|*h).
 * Smooths the field; helps suppress shallow noise and can make deeper anomalies more visible.
 * cellSizeX, cellSizeY = grid spacing in meters (e.g. (xMax-xMin)/(numX-1)).
 */
export function upwardContinuation2D(
  data: number[],
  numX: number,
  numY: number,
  heightMeters: number,
  cellSizeX: number,
  cellSizeY: number
): number[] {
  if (numX < 2 || numY < 2 || data.length !== numX * numY || heightMeters <= 0) return data.slice()
  const Nx = nextPow2(numX)
  const Ny = nextPow2(numY)
  const re = new Float64Array(Nx * Ny)
  const im = new Float64Array(Nx * Ny)
  for (let i = 0; i < numX; i++) {
    for (let j = 0; j < numY; j++) {
      re[i * Ny + j] = data[i * numY + j]
    }
  }
  fft2d(re, im, Nx, Ny, false)
  const dx = Math.max(cellSizeX, 1e-6)
  const dy = Math.max(cellSizeY, 1e-6)
  for (let ii = 0; ii < Nx; ii++) {
    const kx = ii <= Nx / 2 ? (2 * Math.PI * ii) / (Nx * dx) : (2 * Math.PI * (ii - Nx)) / (Nx * dx)
    for (let jj = 0; jj < Ny; jj++) {
      const ky = jj <= Ny / 2 ? (2 * Math.PI * jj) / (Ny * dy) : (2 * Math.PI * (jj - Ny)) / (Ny * dy)
      const k = Math.sqrt(kx * kx + ky * ky)
      const factor = Math.exp(-k * heightMeters)
      const idx = ii * Ny + jj
      re[idx] *= factor
      im[idx] *= factor
    }
  }
  fft2d(re, im, Nx, Ny, true)
  const out: number[] = new Array(data.length)
  for (let i = 0; i < numX; i++) {
    for (let j = 0; j < numY; j++) {
      out[i * numY + j] = re[i * Ny + j]
    }
  }
  return out
}

/**
 * Downward continuation: compute gravity at a lower level (z - h).
 * In Fourier domain: G(k, z-h) = G(k, z) * exp(+|k|*h).
 * Sharpens anomalies and can help separate deep bodies; unstable at high k so we damp.
 * maxFactor caps the multiplier for stability (e.g. 5).
 */
export function downwardContinuation2D(
  data: number[],
  numX: number,
  numY: number,
  heightMeters: number,
  cellSizeX: number,
  cellSizeY: number,
  maxFactor: number = 5
): number[] {
  if (numX < 2 || numY < 2 || data.length !== numX * numY || heightMeters <= 0) return data.slice()
  const Nx = nextPow2(numX)
  const Ny = nextPow2(numY)
  const re = new Float64Array(Nx * Ny)
  const im = new Float64Array(Nx * Ny)
  for (let i = 0; i < numX; i++) {
    for (let j = 0; j < numY; j++) {
      re[i * Ny + j] = data[i * numY + j]
    }
  }
  fft2d(re, im, Nx, Ny, false)
  const dx = Math.max(cellSizeX, 1e-6)
  const dy = Math.max(cellSizeY, 1e-6)
  for (let ii = 0; ii < Nx; ii++) {
    const kx = ii <= Nx / 2 ? (2 * Math.PI * ii) / (Nx * dx) : (2 * Math.PI * (ii - Nx)) / (Nx * dx)
    for (let jj = 0; jj < Ny; jj++) {
      const ky = jj <= Ny / 2 ? (2 * Math.PI * jj) / (Ny * dy) : (2 * Math.PI * (jj - Ny)) / (Ny * dy)
      const k = Math.sqrt(kx * kx + ky * ky)
      const factor = Math.min(Math.exp(k * heightMeters), maxFactor)
      const idx = ii * Ny + jj
      re[idx] *= factor
      im[idx] *= factor
    }
  }
  fft2d(re, im, Nx, Ny, true)
  const out: number[] = new Array(data.length)
  for (let i = 0; i < numX; i++) {
    for (let j = 0; j < numY; j++) {
      out[i * numY + j] = re[i * Ny + j]
    }
  }
  return out
}
