import type { ThemeId } from '../lib/theme'

interface Palette {
  base: string
  colors: [string, string, string, string, string]
  alphas: [string, string, string, string, string]
}

interface BlobGeometry {
  x: number
  y: number
  rx: number
  ry: number
}

/**
 * Static mesh gradients: every blob is a plain radial-gradient painted once.
 * Earlier versions used huge `filter: blur()` layers that were animated with
 * transforms — on integrated GPUs that alone could saturate the WebView2
 * compositor. Gradients look nearly identical and cost no per-frame GPU work.
 */
const PALETTES: Record<string, Palette> = {
  'aurora-light': {
    base: 'linear-gradient(165deg, #FCFBF8 0%, #F7F5EF 52%, #F4F1E9 100%)',
    colors: ['#A5B4FC', '#FDBA74', '#86EFAC', '#C4B5FD', '#F9A8D4'],
    alphas: ['7A', '55', '4D', '5C', '42'],
  },
  'ocean-light': {
    base: 'linear-gradient(165deg, #F9FDFC 0%, #F1FAF7 52%, #EDF6F2 100%)',
    colors: ['#93C5FD', '#5EEAD4', '#6EE7B7', '#A7F3D0', '#67E8F9'],
    alphas: ['7A', '59', '52', '4D', '42'],
  },
  'aurora-dark': {
    base: 'linear-gradient(165deg, #0C0D11 0%, #0E1116 52%, #0A0C10 100%)',
    colors: ['#6366F1', '#F97316', '#10B981', '#8B5CF6', '#EC4899'],
    alphas: ['59', '3D', '33', '47', '2E'],
  },
  'ocean-dark': {
    base: 'linear-gradient(165deg, #071211 0%, #08161A 52%, #06100F 100%)',
    colors: ['#0EA5E9', '#14B8A6', '#10B981', '#22D3EE', '#6366F1'],
    alphas: ['59', '47', '40', '40', '2E'],
  },
}

const WINDOW_GEOMETRY: BlobGeometry[] = [
  { x: -8, y: -10, rx: 62, ry: 56 },
  { x: 64, y: -6, rx: 52, ry: 48 },
  { x: -6, y: 62, rx: 64, ry: 58 },
  { x: 70, y: 56, rx: 58, ry: 52 },
  { x: 36, y: 32, rx: 50, ry: 46 },
]

const FULLSCREEN_GEOMETRY: BlobGeometry[] = [
  { x: -10, y: -14, rx: 70, ry: 62 },
  { x: 72, y: -10, rx: 60, ry: 58 },
  { x: -12, y: 66, rx: 70, ry: 64 },
  { x: 64, y: 60, rx: 66, ry: 60 },
  { x: 34, y: 24, rx: 52, ry: 50 },
]

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

function backgroundFor(key: string, geometry: BlobGeometry[]): string {
  const palette = PALETTES[key] ?? PALETTES['aurora-light']
  const layers = geometry.map(
    (blob, index) =>
      `radial-gradient(${blob.rx}% ${blob.ry}% at ${blob.x}% ${blob.y}%, ${
        palette.colors[index % palette.colors.length]
      }${palette.alphas[index % palette.alphas.length]} 0%, transparent 70%)`,
  )
  return [...layers, palette.base].join(', ')
}

/**
 * Soft colourful aurora / mesh-gradient background.
 * Static by design: no animated blur layers, so the GPU stays idle while idle.
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
  const geometry = variant === 'fullscreen' ? FULLSCREEN_GEOMETRY : WINDOW_GEOMETRY

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{ backgroundImage: backgroundFor(key, geometry) }}
      />
      <div className="absolute inset-0" style={{ background: VEIL[key] ?? VEIL['aurora-light'] }} />
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
