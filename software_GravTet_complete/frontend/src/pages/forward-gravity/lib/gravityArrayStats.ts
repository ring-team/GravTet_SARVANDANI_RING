/** Avoid Math.min(...arr) / Math.max(...arr) — spread hits argument limits (~~100k–1M) and crashes. */

// --- Min / max without spread ---

export function safeMin(arr: number[]): number {
  if (arr.length === 0) return 0
  let m = arr[0]
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] < m) m = arr[i]
  }
  return m
}

export function safeMax(arr: number[]): number {
  if (arr.length === 0) return 0
  let m = arr[0]
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] > m) m = arr[i]
  }
  return m
}

// --- Mean ---

export function safeMean(arr: number[]): number {
  if (arr.length === 0) return 0
  let s = 0
  for (let i = 0; i < arr.length; i++) s += arr[i]
  return s / arr.length
}
