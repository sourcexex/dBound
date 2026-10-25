import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'

/**
 * Scroll container with a custom overlay scrollbar. The native bar is hidden so
 * dragging is a direct 1:1 mouse → scrollTop mapping (no Chromium thumb lag),
 * and the drag also pauses the background animation.
 */
export function ScrollArea({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ startY: number; startScroll: number } | null>(null)
  const [thumb, setThumb] = useState({ visible: false, height: 26, top: 0 })

  const sync = useCallback(() => {
    const viewport = viewportRef.current
    const track = trackRef.current
    if (!viewport || !track) return
    const trackHeight = track.clientHeight
    const maxScroll = viewport.scrollHeight - viewport.clientHeight
    if (maxScroll <= 1 || trackHeight <= 0) {
      setThumb((previous) => (previous.visible ? { ...previous, visible: false } : previous))
      return
    }
    const height = Math.max(26, Math.round((viewport.clientHeight / viewport.scrollHeight) * trackHeight))
    const top = Math.round((viewport.scrollTop / maxScroll) * (trackHeight - height))
    setThumb((previous) => {
      if (previous.visible && previous.height === height && previous.top === top) return previous
      return { visible: true, height, top }
    })
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(viewport)
    if (viewport.firstElementChild) observer.observe(viewport.firstElementChild)
    return () => observer.disconnect()
  }, [sync])

  const markScrolling = (active: boolean) => {
    if (active) {
      document.documentElement.dataset.scrolling = 'true'
    } else {
      delete document.documentElement.dataset.scrolling
    }
  }

  const beginDrag = (event: MouseEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current
    if (!viewport) return
    event.preventDefault()
    event.stopPropagation()
    markScrolling(true)
    dragRef.current = { startY: event.clientY, startScroll: viewport.scrollTop }

    const onMove = (moveEvent: globalThis.MouseEvent) => {
      const track = trackRef.current
      const drag = dragRef.current
      if (!track || !drag) return
      const maxScroll = viewport.scrollHeight - viewport.clientHeight
      const usable = track.clientHeight - thumb.height
      if (maxScroll <= 0 || usable <= 0) return
      viewport.scrollTop = drag.startScroll + ((moveEvent.clientY - drag.startY) / usable) * maxScroll
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.setTimeout(() => markScrolling(false), 160)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const jumpTo = (event: MouseEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current
    const track = trackRef.current
    if (!viewport || !track) return
    const rect = track.getBoundingClientRect()
    const maxScroll = viewport.scrollHeight - viewport.clientHeight
    const usable = Math.max(1, track.clientHeight - thumb.height)
    const ratio = Math.min(1, Math.max(0, (event.clientY - rect.top - thumb.height / 2) / usable))
    viewport.scrollTop = ratio * maxScroll
  }

  return (
    <div className={`relative ${className}`}>
      <div
        ref={viewportRef}
        onScroll={sync}
        className="scrollbar-none h-full overflow-y-auto overscroll-contain pr-3"
      >
        {children}
      </div>

      <div
        ref={trackRef}
        onMouseDown={jumpTo}
        className="absolute top-1 right-0.5 bottom-1 w-[9px] rounded-full"
        aria-hidden
      >
        {thumb.visible ? (
          <div
            onMouseDown={beginDrag}
            className="absolute right-1 w-[7px] cursor-grab rounded-full bg-ink/30 transition-colors duration-150 hover:bg-ink/45 active:cursor-grabbing active:bg-ink/60"
            style={{ height: thumb.height, top: thumb.top }}
          />
        ) : null}
      </div>
    </div>
  )
}
