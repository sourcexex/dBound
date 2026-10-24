/** Tauri bridge helpers that degrade gracefully when the UI runs in a plain browser. */

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

type WindowModule = typeof import('@tauri-apps/api/window')

async function currentWindow(): Promise<WindowModule['getCurrentWindow'] | null> {
  if (!isTauri()) return null
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  return getCurrentWindow
}

export async function minimizeWindow(): Promise<void> {
  const getWindow = await currentWindow()
  if (!getWindow) return
  await getWindow().minimize().catch(() => undefined)
}

export async function hideWindow(): Promise<void> {
  const getWindow = await currentWindow()
  if (!getWindow) return
  await getWindow().hide().catch(() => undefined)
}

export async function closeWindow(): Promise<void> {
  const getWindow = await currentWindow()
  if (!getWindow) return
  await getWindow().close().catch(() => undefined)
}

export async function startDragging(): Promise<void> {
  const getWindow = await currentWindow()
  if (!getWindow) return
  await getWindow().startDragging().catch(() => undefined)
}
