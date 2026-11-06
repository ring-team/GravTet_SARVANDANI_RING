/** Unicode superscript digits for colorbar scientific notation (no ASCII `^`). */

const SUPERSCRIPT_DIGIT: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
}

export function integerToSuperscript(n: number): string {
  const exp = Math.round(n)
  if (!Number.isFinite(exp)) return String(n)
  const sign = exp < 0 ? '⁻' : ''
  const body = String(Math.abs(exp))
    .split('')
    .map((ch) => SUPERSCRIPT_DIGIT[ch] ?? ch)
    .join('')
  return sign + body
}

const SUPERSCRIPT_TO_DIGIT: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
}

function superscriptExponentToInteger(s: string): number {
  let sign = 1
  let body = s
  if (body.startsWith('⁻')) {
    sign = -1
    body = body.slice(1)
  }
  const digits = body
    .split('')
    .map((ch) => SUPERSCRIPT_TO_DIGIT[ch] ?? ch)
    .join('')
  const n = Number.parseInt(digits, 10)
  return Number.isFinite(n) ? sign * n : Number.NaN
}

/** Parseable value for colorbar min/max inputs (``parseFloat``-safe). */
export function formatColorbarInputValue(v: number, expDigits = 6): string {
  if (!Number.isFinite(v)) return ''
  if (v === 0) return '0'
  const a = Math.abs(v)
  if (a < 1e-4 || a >= 1e6) return v.toExponential(Math.max(1, Math.min(8, expDigits)))
  return String(v)
}

/**
 * Parse manual colorbar input: plain decimals, ``1.2e-5``, or ``1.2 × 10⁻⁵``.
 * ``parseFloat`` alone fails on Unicode scientific labels (reads only the mantissa).
 */
export function parseColorbarManualValue(raw: string): number {
  const s = raw.trim()
  if (!s) return Number.NaN
  const asciiSci = s.match(/^(-?[\d.]+)\s*[eE]\s*([-+]?\d+)$/)
  if (asciiSci) {
    const n = Number.parseFloat(`${asciiSci[1]}e${asciiSci[2]}`)
    return Number.isFinite(n) ? n : Number.NaN
  }
  const unicodeSci = s.match(/^(-?[\d.]+)\s*[×x]\s*10([⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/i)
  if (unicodeSci) {
    const exp = superscriptExponentToInteger(unicodeSci[2])
    if (!Number.isFinite(exp)) return Number.NaN
    const mantissa = Number.parseFloat(unicodeSci[1])
    if (!Number.isFinite(mantissa)) return Number.NaN
    return mantissa * 10 ** exp
  }
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : Number.NaN
}

/** e.g. ``1.768 × 10⁻⁴`` (mantissa digits controlled by ``expDigits``). */
export function formatScientificColorbarLabel(v: number, expDigits = 3): string {
  if (!Number.isFinite(v) || Math.abs(v) < 1e-310) return '0'
  const fd = Math.max(1, Math.min(8, Math.round(expDigits)))
  const raw = v.toExponential(fd)
  const m = raw.match(/^(-?)(\d(?:\.\d+)?)e([-+]?\d+)$/i)
  if (!m) {
    return raw.replace(/e([-+]?\d+)/i, (_, exp: string) => ` × 10${integerToSuperscript(Number(exp))}`)
  }
  const mantissa = m[1] + m[2]
  return `${mantissa} × 10${integerToSuperscript(Number(m[3]))}`
}
