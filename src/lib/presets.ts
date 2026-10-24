import type { Level, Mode } from './types'

/** Colour board offered in the level editor. */
export const LEVEL_PALETTE = [
  '#2563EB', // blue
  '#0EA5E9', // sky
  '#0891B2', // cyan
  '#0D9488', // teal
  '#16A34A', // green
  '#CA8A04', // yellow
  '#D97706', // amber
  '#EA580C', // orange
  '#DC2626', // red
  '#BE123C', // rose
] as const

export const DEFAULT_FORWARD_LEVELS: Level[] = [
  {
    id: 'f-1',
    threshold: 65,
    name: '注意',
    note: '有点吵了',
    color: '#2563EB',
    enabled: true,
  },
  {
    id: 'f-2',
    threshold: 75,
    name: '警告',
    note: '声音偏大，注意一下',
    color: '#D97706',
    enabled: true,
  },
  {
    id: 'f-3',
    threshold: 85,
    name: '危险',
    note: '太吵了',
    color: '#DC2626',
    enabled: true,
  },
]

export const DEFAULT_REVERSE_LEVELS: Level[] = [
  {
    id: 'r-1',
    threshold: 60,
    name: '偏小',
    note: '声音偏小，再大声一点',
    color: '#2563EB',
    enabled: true,
  },
  {
    id: 'r-2',
    threshold: 50,
    name: '过小',
    note: '几乎听不到你的声音',
    color: '#D97706',
    enabled: true,
  },
  {
    id: 'r-3',
    threshold: 40,
    name: '无声',
    note: '没有检测到声音',
    color: '#DC2626',
    enabled: true,
  },
]

export function defaultLevels(mode: Mode): Level[] {
  return (mode === 'forward' ? DEFAULT_FORWARD_LEVELS : DEFAULT_REVERSE_LEVELS).map((l) => ({ ...l }))
}
