import { useCallback, useEffect, useRef } from 'react'
import type { Level } from '../lib/types'

const VIS_MIN = 20
const VIS_MAX = 100
const HISTORY_POINTS = 600

function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '')
  const normalized =
    value.length === 3
      ? value
          .split('')
          .map((char) => char + char)
          .join('')
      : value
  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function Waveform({
  history,
  levels,
  accent,
}: {
  history: number[]
  levels: Level[]
  accent: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return

    const rect = wrap.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const width = Math.max(1, Math.floor(rect.width))
    const height = Math.max(1, Math.floor(rect.height))

    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    const padY = 10
    const toY = (db: number) => {
      const ratio = Math.min(1, Math.max(0, (db - VIS_MIN) / (VIS_MAX - VIS_MIN)))
      return height - padY - ratio * (height - padY * 2)
    }

    // Threshold guides – dashed, tinted with the level colour.
    for (const level of levels) {
      if (!level.enabled) continue
      if (level.threshold < VIS_MIN || level.threshold > VIS_MAX) continue
      const y = toY(level.threshold)
      ctx.save()
      ctx.strokeStyle = hexToRgba(level.color, 0.45)
      ctx.setLineDash([4, 5])
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
      ctx.restore()
    }

    // Baseline.
    ctx.strokeStyle = 'rgba(23, 23, 26, 0.08)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, height - padY)
    ctx.lineTo(width, height - padY)
    ctx.stroke()

    const points = history.slice(-HISTORY_POINTS)
    if (points.length < 2) return

    const inset = 3
    const drawable = width - inset * 2
    const step = drawable / (HISTORY_POINTS - 1)
    const xAt = (index: number) => width - inset - (points.length - 1 - index) * step
    const yAt = (db: number) => toY(db)

    // Filled area.
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, hexToRgba(accent, 0.2))
    gradient.addColorStop(1, hexToRgba(accent, 0.02))
    ctx.beginPath()
    ctx.moveTo(xAt(0), yAt(points[0]))
    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(xAt(i), yAt(points[i]))
    }
    ctx.lineTo(xAt(points.length - 1), height - padY)
    ctx.lineTo(xAt(0), height - padY)
    ctx.closePath()
    ctx.fillStyle = gradient
    ctx.fill()

    // Line.
    ctx.beginPath()
    ctx.moveTo(xAt(0), yAt(points[0]))
    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(xAt(i), yAt(points[i]))
    }
    ctx.strokeStyle = hexToRgba(accent, 0.85)
    ctx.lineWidth = 1.6
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.stroke()

    // Head dot.
    const headX = xAt(points.length - 1)
    const headY = yAt(points[points.length - 1])
    ctx.beginPath()
    ctx.arc(headX - 1, headY, 2.4, 0, Math.PI * 2)
    ctx.fillStyle = accent
    ctx.fill()
  }, [history, levels, accent])

  useEffect(() => {
    draw()
  }, [draw])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const observer = new ResizeObserver(() => draw())
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [draw])

  return (
    <div ref={wrapRef} className="h-[86px] w-full">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  )
}
