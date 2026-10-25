import type { ThemeId } from '../lib/theme'

interface BlobGeometry {
  left: string
  top: string
  size: string
  blur: number
  /** Which drift animation to use. */
  anim: 0 | 1
  delay: number
  duration: number
}

const WINDOW_LAYOUT: BlobGeometry[] = [
  { left: '-20%', top: '-16%', size: '300px', blur: 74, anim: 0, delay: 0, duration: 26 },
  { left: '56%', top: '-10%', size: '260px', blur: 80, anim: 1, delay: 3, duration: 30 },
  { left: '-14%', top: '56%', size: '300px', blur: 86, anim: 1, delay: 6, duration: 32 },
  { left: '60%', top: '50%', size: '280px', blur: 82, anim: 0, delay: 2, duration: 28 },
  { left: '26%', top: '24%', size: '240px', blur: 92, anim: 1, delay: 5, duration: 34 },
]

const FULLSCREEN_LAYOUT: BlobGeometry[] = [
  { left: '-12%', top: '-20%', size: '54vw', blur: 165, anim: 0, delay: 0, duration: 38 },
  { left: '64%', top: '-16%', size: '48vw', blur: 175, anim: 1, delay: 4, duration: 44 },
  { left: '-16%', top: '60%', size: '52vw', blur: 185, anim: 1, delay: 8, duration: 46 },
  { left: '56%', top: '52%', size: '56vw', blur: 180, anim: 0, delay: 2, duration: 40 },
  { left: '24%', top: '16%', size: '40vw', blur: 195, anim: 1, delay: 6, duration: 50 },
]

const PALETTES: Record<string, { colors: string[]; opacity: number[] }> = {
  'aurora-light': {
    colors: ['#A5B4FC', '#FDBA74', '#86EFAC', '#C4B5FD', '#F9A8D4'],
    opacity: [0.62, 0.52, 0.46, 0.5, 0.4],
  },
  'ocean-light': {
    colors: ['#93C5FD', '#5EEAD4', '#6EE7B7', '#A7F3D0', '#67E8F9'],
    opacity: [0.6, 0.5, 0.46, 0.44, 0.4],
  },
  'aurora-dark': {
    colors: ['#6366F1', '#F97316', '#10B981', '#8B5CF6', '#EC4899'],
    opacity: [0.42, 0.3, 0.26, 0.34, 0.24],
  },
  'ocean-dark': {
    colors: ['#0EA5E9', '#14B8A6', '#10B981', '#22D3EE', '#6366F1'],
    opacity: [0.42, 0.34, 0.3, 0.3, 0.24],
  },
}

const BASE: Record<string, string> = {
  'aurora-light': 'linear-gradient(165deg, #FCFBF8 0%, #F7F5EF 52%, #F4F1E9 100%)',
  'ocean-light': 'linear-gradient(165deg, #F9FDFC 0%, #F1FAF7 52%, #EDF6F2 100%)',
  'aurora-dark': 'linear-gradient(165deg, #0C0D11 0%, #0E1116 52%, #0A0C10 100%)',
  'ocean-dark': 'linear-gradient(165deg, #071211 0%, #08161A 52%, #06100F 100%)',
}

const VEIL: Record<string, string> = {
  'aurora-light':
    'radial-gradient(120% 95% at 50% 45%, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.16) 46%, rgba(255,255,255,0) 72%)',
  'ocean-light':
    'radial-gradient(120% 95% at 50% 45%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.18) 46%, rgba(255,255,255,0) 72%)',
  'aurora-dark':
    'radial-gradient(120% 95% at 50% 45%, rgba(8,10,14,0.5) 0%, rgba(8,10,14,0.22) 50%, rgba(8,10,14,0) 76%)',
  'ocean-dark':
    'radial-gradient(120% 95% at 50% 45%, rgba(5,10,10,0.5) 0%, rgba(5,10,10,0.22) 50%, rgba(5,10,10,0) 76%)',
}

const NOISE_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")"

/**
 * Soft colourful aurora / mesh-gradient background.
 * Large blurred blobs drift very slowly behind the UI; nothing is interactive.
 */
export function AuroraBackground({
  variant = 'window',
  theme = 'aurora',
  dark = false,
}: {
  variant?: 'window' | 'fullscreen'
  theme?: ThemeId
  dark?: boolean
}) {
  const key = `${theme}-${dark ? 'dark' : 'light'}`
  const palette = PALETTES[key] ?? PALETTES['aurora-light']
  const layout = variant === 'fullscreen' ? FULLSCREEN_LAYOUT : WINDOW_LAYOUT

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0" style={{ background: BASE[key] ?? BASE['aurora-light'] }} />

      {layout.map((geometry, index) => (
        <span
          key={index}
          className="dbound-aurora-blob absolute rounded-full will-change-transform"
          style={{
            left: geometry.left,
            top: geometry.top,
            width: geometry.size,
            height: geometry.size,
            backgroundColor: palette.colors[index % palette.colors.length],
            opacity: palette.opacity[index % palette.opacity.length],
            filter: `blur(${geometry.blur}px)`,
            animation: `dbound-drift-${geometry.anim === 0 ? 'a' : 'b'} ${geometry.duration}s ease-in-out ${geometry.delay}s infinite`,
          }}
        />
      ))}

      {/* soft veil keeps the centre readable */}
      <div
        className="absolute inset-0"
        style={{ background: VEIL[key] ?? VEIL['aurora-light'] }}
      />

      {/* fine grain for a printed, premium feel */}
      <div
        className="absolute inset-0 mix-blend-soft-light"
        style={{
          backgroundImage: NOISE_URL,
          backgroundSize: '160px 160px',
          opacity: dark ? 0.22 : 0.32,
        }}
      />
    </div>
  )
}
