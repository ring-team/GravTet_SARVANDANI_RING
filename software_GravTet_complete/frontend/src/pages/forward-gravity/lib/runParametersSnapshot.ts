/** Client-side ``parameters.json`` envelope (same shape as former ``/api/save_model_data`` writes). */

export type RunParametersSnapshot = {
  method: string
  model_type: string
  saved_at_unix_seconds: number
  /** Deprecated alias (same value): older files used ``timestamp`` for this clock only. */
  timestamp: number
  parameters: Record<string, unknown>
}

/** Mirror ``backend/api/gravity/helpers.py`` ``normalize_method_dir``. */
export function normalizeMethodDir(method: unknown): string {
  let m = method == null ? '' : String(method).trim().toLowerCase()
  if (m === '' || m === 'none' || m === 'null' || m === 'undefined') m = 'unknown'
  if (m === 'amfm' || m === 'amfm_gravity') m = 'amf_plus_advanced_newton'
  else if (m === 'barnes_hut' || m === 'barnes-hut' || m === 'barnes_hut_gravity') {
    m = 'barnes_hut_plus_advanced_newton'
  }
  const out: string[] = []
  for (const ch of m) {
    if (/[a-z0-9_.-]/.test(ch)) out.push(ch)
    else if (ch === ' ' || ch === '+' || ch === '/') out.push('_')
    else out.push('_')
  }
  return out.join('') || 'unknown'
}

export function buildRunParametersSnapshot(
  method: string,
  modelType: string,
  parameters: Record<string, unknown>,
  timestamp = Math.floor(Date.now() / 1000),
): RunParametersSnapshot {
  return {
    method: normalizeMethodDir(method),
    model_type: modelType || 'Unknown',
    saved_at_unix_seconds: timestamp,
    timestamp,
    parameters,
  }
}

export type RunParametersExportFormat = 'json' | 'txt'

function formatParameterValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function appendParameterLines(lines: string[], value: unknown, indent: number, key?: string): void {
  const pad = '  '.repeat(indent)
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    const keys = Object.keys(record).sort()
    if (key != null) {
      lines.push(`${pad}${key}:`)
      keys.forEach((childKey) => appendParameterLines(lines, record[childKey], indent + 1, childKey))
      return
    }
    keys.forEach((childKey) => appendParameterLines(lines, record[childKey], indent, childKey))
    return
  }
  if (key != null) {
    lines.push(`${pad}${key}: ${formatParameterValue(value)}`)
  }
}

export function formatRunParametersAsText(snapshot: RunParametersSnapshot): string {
  const lines: string[] = [
    `method: ${snapshot.method}`,
    `model_type: ${snapshot.model_type}`,
    `saved_at_unix_seconds: ${snapshot.saved_at_unix_seconds}`,
    `timestamp: ${snapshot.timestamp}`,
    '',
    'parameters:',
  ]
  appendParameterLines(lines, snapshot.parameters, 1)
  return `${lines.join('\n')}\n`
}

export function downloadRunParametersFile(
  snapshot: RunParametersSnapshot,
  format: RunParametersExportFormat = 'txt',
): void {
  const isTxt = format === 'txt'
  const content = isTxt ? formatRunParametersAsText(snapshot) : JSON.stringify(snapshot, null, 2)
  const blob = new Blob([content], { type: isTxt ? 'text/plain;charset=utf-8' : 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = isTxt ? 'parameters.txt' : 'parameters.json'
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
