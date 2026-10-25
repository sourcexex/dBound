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
    threshold: 43.5,
    name: '注意😤😤😤',
    note: '我看到你了哦',
    color: '#EA580C',
    enabled: true,
  },
]

export const DEFAULT_REVERSE_LEVELS: Level[] = [
  {
    id: 'r-2',
    threshold: 65,
    name: '加油啊！🤯🥳',
    note: '早读不开口，气势少一半！',
    color: '#EA580C',
    enabled: true,
  },
]

export function defaultLevels(mode: Mode): Level[] {
  return (mode === 'forward' ? DEFAULT_FORWARD_LEVELS : DEFAULT_REVERSE_LEVELS).map((l) => ({ ...l }))
}
