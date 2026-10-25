interface Blob {
  color: string
  left: string
  top: string
  size: string
  opacity: number
  blur: number
  /** Which drift animation to use. */
  anim: 0 | 1
  delay: number
  duration: number
}

const WINDOW_BLOBS: Blob[] = [
  { color: '#A5B4FC', left: '-20%', top: '-16%', size: '300px', opacity: 0.62, blur: 74, anim: 0, delay: 0, duration: 26 },
  { color: '#FDBA74', left: '56%', top: '-10%', size: '260px', opacity: 0.52, blur: 80, anim: 1, delay: 3, duration: 30 },
  { color: '#86EFAC', left: '-14%', top: '56%', size: '300px', opacity: 0.46, blur: 86, anim: 1, delay: 6, duration: 32 },
  { color: '#C4B5FD', left: '60%', top: '50%', size: '280px', opacity: 0.5, blur: 82, anim: 0, delay: 2, duration: 28 },
  { color: '#F9A8D4', left: '26%', top: '24%', size: '240px', opacity: 0.4, blur: 92, anim: 1, delay: 5, duration: 34 },
]

const FULLSCREEN_BLOBS: Blob[] = [
  { color: '#93C5FD', left: '-12%', top: '-20%', size: '54vw', opacity: 0.62, blur: 165, anim: 0, delay: 0, duration: 38 },
  { color: '#FDBA74', left: '64%', top: '-16%', size: '48vw', opacity: 0.55, blur: 175, anim: 1, delay: 4, duration: 44 },
  { color: '#86EFAC', left: '-16%', top: '60%', size: '52vw', opacity: 0.48, blur: 185, anim: 1, delay: 8, duration: 46 },
  { color: '#C4B5FD', left: '56%', top: '52%', size: '56vw', opacity: 0.52, blur: 180, anim: 0, delay: 2, duration: 40 },
  { color: '#F9A8D4', left: '24%', top: '16%', size: '40vw', opacity: 0.42, blur: 195, anim: 1, delay: 6, duration: 50 },
]

/**
 * Soft colourful aurora / mesh-gradient background.
 * Large blurred blobs drift very slowly behind the UI; nothing is interactive.
 */
const NOISE_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")"

export function AuroraBackground({ variant = 'window' }: { variant?: 'window' | 'fullscreen' }) {
  const blobs = variant === 'fullscreen' ? FULLSCREEN_BLOBS : WINDOW_BLOBS

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(165deg, #FCFBF8 0%, #F7F5EF 52%, #F4F1E9 100%)',
        }}
      />
      {blobs.map((blob, index) => (
        <span
          key={index}
          className="dbound-aurora-blob absolute rounded-full will-change-transform"
          style={{
            left: blob.left,
            top: blob.top,
            width: blob.size,
            height: blob.size,
            backgroundColor: blob.color,
            opacity: blob.opacity,
            filter: `blur(${blob.blur}px)`,
            animation: `dbound-drift-${blob.anim === 0 ? 'a' : 'b'} ${blob.duration}s ease-in-out ${blob.delay}s infinite`,
          }}
        />
      ))}

      {/* soft white veil keeps the centre readable */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 95% at 50% 45%, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.16) 46%, rgba(255,255,255,0) 72%)',
        }}
      />

      {/* fine grain for a printed, premium feel */}
      <div
        className="absolute inset-0 mix-blend-soft-light"
        style={{ backgroundImage: NOISE_URL, backgroundSize: '160px 160px', opacity: 0.32 }}
      />
    </div>
  )
}
