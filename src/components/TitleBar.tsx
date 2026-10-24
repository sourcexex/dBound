import { Minus, PictureInPicture2, Settings, X } from 'lucide-react'
import { closeWindow, minimizeWindow } from '../lib/tauri'

function ControlButton({
  label,
  onClick,
  children,
  danger = false,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  danger?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      onPointerDown={(event) => event.stopPropagation()}
      className={`grid h-7 w-7 place-items-center rounded-md text-ink-soft transition-colors duration-150 ${
        danger ? 'hover:bg-[#DC2626] hover:text-white' : 'hover:bg-black/[0.06] hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

export function TitleBar({
  onOpenSettings,
  onOpenMini,
}: {
  onOpenSettings?: () => void
  onOpenMini?: () => void
}) {
  return (
    <header
      data-tauri-drag-region
      className="flex h-12 shrink-0 items-center justify-between pl-5 pr-2"
    >
      <div data-tauri-drag-region className="flex items-center gap-2">
        <span className="relative grid h-[18px] w-[18px] place-items-center rounded-[6px] bg-ink">
          <span className="h-[6px] w-[6px] rounded-full bg-[#F2C94C]" />
        </span>
        <span
          data-tauri-drag-region
          className="text-[13px] font-semibold tracking-[0.01em] text-ink"
        >
          dBound
        </span>
      </div>

      <div className="flex items-center gap-0.5">
        {onOpenMini ? (
          <ControlButton label="迷你窗" onClick={onOpenMini}>
            <PictureInPicture2 size={14} strokeWidth={2} />
          </ControlButton>
        ) : null}
        {onOpenSettings ? (
          <ControlButton label="设置" onClick={onOpenSettings}>
            <Settings size={14} strokeWidth={2} />
          </ControlButton>
        ) : null}
        <ControlButton label="最小化" onClick={() => void minimizeWindow()}>
          <Minus size={14} strokeWidth={2} />
        </ControlButton>
        <ControlButton label="关闭" danger onClick={() => void closeWindow()}>
          <X size={14} strokeWidth={2} />
        </ControlButton>
      </div>
    </header>
  )
}
