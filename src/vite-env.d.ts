/// <reference types="vite/client" />

/** Injected by vite.config.ts from src-tauri/tauri.conf.json. */
declare const __APP_VERSION__: string

interface ImportMetaEnv {
  /** When set to a dB value, the monitor synthesises that level instead of using a mic. */
  readonly VITE_DBOUND_SIM?: string
  /** Optional mode used together with VITE_DBOUND_SIM: 'forward' | 'reverse'. */
  readonly VITE_DBOUND_SIM_MODE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
