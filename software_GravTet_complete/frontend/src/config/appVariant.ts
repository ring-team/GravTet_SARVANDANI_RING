import type { ViewKey } from '../types/view'

export const isExecutionBundle =
  typeof import.meta !== 'undefined' &&
  (Boolean((import.meta as ImportMeta & { env?: { VITE_EXECUTION_BUNDLE?: string } }).env?.VITE_EXECUTION_BUNDLE) ||
    (import.meta as ImportMeta & { env?: { VITE_APP_VARIANT?: string } }).env?.VITE_APP_VARIANT === 'execution')

/** Views hidden in the execution bundle (none in quadrature-only UI). */
export const EXECUTION_HIDDEN_VIEWS: ReadonlySet<ViewKey> = new Set([])
