import { useEffect } from 'react'
import { useLevelStore } from '../stores/level'

/** Transient confirmation pill (e.g. "已保存事件录音 · 14.9 秒"). */
export function Toast({ bottom = '86px' }: { bottom?: string }) {
  const toast = useLevelStore((state) => state.toast)
  const setToast = useLevelStore((state) => state.setToast)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(timer)
  }, [toast, setToast])

  if (!toast) return null

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-30 flex justify-center px-6"
      style={{ bottom }}
    >
      <div className="dbound-rise max-w-full truncate rounded-full border border-line bg-surface/95 px-4 py-2 text-[12px] font-medium text-ink shadow-[0_8px_24px_rgba(0,0,0,0.14)]">
        {toast}
      </div>
    </div>
  )
}
