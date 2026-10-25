/** Font choices for the fullscreen title, mapped to stacks that exist on Windows. */

export interface TitleFontOption {
  id: string
  label: string
  stack: string
}

export const TITLE_FONTS: TitleFontOption[] = [
  { id: 'system', label: '系统默认', stack: 'var(--font-sans)' },
  { id: 'yahei', label: '微软雅黑', stack: '"Microsoft YaHei UI", "Microsoft YaHei", sans-serif' },
  { id: 'simhei', label: '黑体', stack: 'SimHei, "Microsoft YaHei UI", sans-serif' },
  { id: 'kaiti', label: '楷体', stack: 'KaiTi, "STKaiti", "Microsoft YaHei UI", serif' },
  { id: 'simsun', label: '宋体', stack: 'SimSun, "Songti SC", "Microsoft YaHei UI", serif' },
  { id: 'dengxian', label: '等线', stack: 'DengXian, "Microsoft YaHei UI", sans-serif' },
  { id: 'mono', label: '等宽', stack: 'Consolas, "Cascadia Mono", "Courier New", monospace' },
]

export const DEFAULT_TITLE_FONT = 'system'
export const TITLE_SIZE_MIN = 14
export const TITLE_SIZE_MAX = 56
export const DEFAULT_TITLE_SIZE = 20
export const DEFAULT_TITLE_COLOR = '#17171A'

export const SUBTITLE_SIZE_MIN = 10
export const SUBTITLE_SIZE_MAX = 40
export const DEFAULT_SUBTITLE_SIZE = 13
export const DEFAULT_SUBTITLE_COLOR = '#6B6B72'

export function fontStackFor(id: string): string {
  return TITLE_FONTS.find((font) => font.id === id)?.stack ?? TITLE_FONTS[0].stack
}

export function isKnownTitleFont(id: unknown): id is string {
  return typeof id === 'string' && TITLE_FONTS.some((font) => font.id === id)
}
