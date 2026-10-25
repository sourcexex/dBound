/** Shared naming/IO helpers for evidence files. */

export function evidenceStamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('-')
}

export async function saveEvidenceBytes(
  dir: string,
  filename: string,
  bytes: Uint8Array,
): Promise<string> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<string>('save_evidence', {
    dir: dir || null,
    filename,
    data: Array.from(bytes),
  })
}
