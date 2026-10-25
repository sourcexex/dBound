export type ThemeId = 'aurora' | 'ocean'

export const DEFAULT_THEME: ThemeId = 'aurora'
export const DEFAULT_DARK_MODE = false

export function isThemeId(value: unknown): value is ThemeId {
  return value === 'aurora' || value === 'ocean'
}

/** Concrete colours for canvas / inline styles, resolved per appearance. */
export function accentFallback(dark: boolean): string {
  return dark ? '#F2F3F1' : '#17171A'
}

export function mutedFallback(dark: boolean): string {
  return dark ? '#3A3D45' : '#C7C6BE'
}

export function dimmedNumber(dark: boolean): string {
  return dark ? '#5E6168' : '#A9A8A1'
}

export function placeholderNumber(dark: boolean): string {
  return dark ? '#4A4D55' : '#CFCEC7'
}

export const THEME_OPTIONS: Array<{ id: ThemeId; label: string; hint: string; preview: string }> = [
  {
    id: 'aurora',
    label: '极光',
    hint: '靛蓝 · 蜜橙 · 浅绿 · 薰衣草',
    preview:
      'linear-gradient(135deg, #A5B4FC 0%, #FDBA74 34%, #86EFAC 68%, #C4B5FD 100%)',
  },
  {
    id: 'ocean',
    label: '薄荷',
    hint: '湖蓝 · 青绿 · 薄荷绿',
    preview:
      'linear-gradient(135deg, #93C5FD 0%, #5EEAD4 38%, #6EE7B7 70%, #A7F3D0 100%)',
  },
]
