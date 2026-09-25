import type { ViewKey } from '../types/view'

/** Execution bundle builds set VITE_EXECUTION_BUNDLE=1 (simplified UI for prebuilt). */
export const isExecutionBundle = import.meta.env.VITE_EXECUTION_BUNDLE === '1'

/** Forward methods / views hidden in the execution bundle (only quadrature + analytical closed-form kept). */
export const EXECUTION_HIDDEN_VIEWS: ReadonlySet<ViewKey> = new Set(['method1_reference', 'method1_reference_tiled', 'method1_simd_tiled', 'method1_simd_threading_tiled', 'barnes_hut', 'amfm'])
