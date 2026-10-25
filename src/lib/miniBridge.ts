import { isTauri } from './tauri'
import type { Mode } from './types'

export const MINI_STATE_EVENT = 'dbound:mini-state'
export const MINI_COMMAND_EVENT = 'dbound:mini-command'

export interface MiniState {
  db: number | null
  peak: number | null
  color: string
  name: string | null
  mode: Mode
  /** Custom display name of the current mode (e.g. 早读模式). */
  modeLabel: string
  running: boolean
  paused: boolean
}

type EmitFn = (event: string, payload?: unknown) => Promise<void>

let cachedEmit: EmitFn | null = null

async function getEmit(): Promise<EmitFn | null> {
  if (!isTauri()) return null
  if (!cachedEmit) {
    const { emit } = await import('@tauri-apps/api/event')
    cachedEmit = emit as EmitFn
  }
  return cachedEmit
}

/** Push the current reading to the mini capsule window (best effort). */
export async function emitMiniState(state: MiniState): Promise<void> {
  const emit = await getEmit()
  if (!emit) return
  await emit(MINI_STATE_EVENT, state).catch(() => undefined)
}

/** Open (or focus) the mini capsule window and hide the main window. */
export async function showMiniWindow(): Promise<void> {
  if (!isTauri()) return
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('show_mini').catch(() => undefined)
}

/** Show the main window again and hide the capsule. */
export async function showMainWindow(): Promise<void> {
  if (!isTauri()) return
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('show_main_window').catch(() => undefined)
}

/** Open the full-screen presentation window and hide the other windows. */
export async function showFullscreen(): Promise<void> {
  if (!isTauri()) return
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('show_fullscreen').catch(() => undefined)
}

/** Subscribe to commands sent by the mini window (e.g. it just became ready). */
export async function listenMiniCommands(
  handler: (command: string) => void,
): Promise<() => void> {
  if (!isTauri()) return () => undefined
  const { listen } = await import('@tauri-apps/api/event')
  return listen<{ command: string }>(MINI_COMMAND_EVENT, (event) => {
    handler(event.payload?.command ?? '')
  })
}
