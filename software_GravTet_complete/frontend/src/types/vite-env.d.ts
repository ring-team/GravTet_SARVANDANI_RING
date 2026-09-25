/// <reference types="vite/client" />

/** Augments Vite’s `import.meta.env` for TypeScript; keep in sync with `.env*` variable names. */
interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_EXECUTION_BUNDLE?: string
}
