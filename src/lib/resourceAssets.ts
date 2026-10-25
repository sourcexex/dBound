import { convertFileSrc, isTauri } from '@tauri-apps/api/core'
import { join, resourceDir } from '@tauri-apps/api/path'

/**
 * Emoji art ships as loose files under <install>/resources/ so the installer
 * exposes a normal resources folder instead of hiding ~1600 images inside the
 * executable. Asset URLs are resolved once at startup.
 */
let emojiBase = ''
let rewardBase = ''

export async function initResourceAssets(): Promise<void> {
  if (!isTauri()) return
  try {
    const root = await resourceDir()
    emojiBase = await join(root, 'resources', 'emoji')
    rewardBase = await join(root, 'resources', 'emoji-reward')
  } catch (error) {
    console.warn('resource dir unavailable, emoji will fall back to system font', error)
  }
}

function fileUrl(base: string, name: string): string | undefined {
  if (!base) return undefined
  return convertFileSrc(`${base}/${name}.png`)
}

export function emojiFileUrl(key: string): string | undefined {
  return fileUrl(emojiBase, key)
}

export function rewardFileUrl(key: string): string | undefined {
  return fileUrl(rewardBase, key)
}
