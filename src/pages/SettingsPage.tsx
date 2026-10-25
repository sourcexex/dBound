import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { CalibrationPanel } from '../components/settings/CalibrationPanel'
import { DevicesPanel } from '../components/settings/DevicesPanel'
import { FullscreenPanel } from '../components/settings/FullscreenPanel'
import { LevelsPanel } from '../components/settings/LevelsPanel'
import { ModePanel } from '../components/settings/ModePanel'
import { SystemPanel } from '../components/settings/SystemPanel'

const TABS = [
  { id: 'mode', label: '模式' },
  { id: 'levels', label: '级别' },
  { id: 'calibration', label: '校准' },
  { id: 'fullscreen', label: '全屏' },
  { id: 'devices', label: '设备' },
  { id: 'system', label: '系统' },
] as const

type TabId = (typeof TABS)[number]['id']

export function SettingsPage({
  onBack,
  onRestartDevice,
}: {
  onBack: () => void
  onRestartDevice: (deviceId: string) => void
}) {
  const [tab, setTab] = useState<TabId>('mode')

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex h-12 shrink-0 items-center gap-1 pl-2 pr-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="返回"
          className="flex items-center gap-1 rounded-md px-2 py-1.5 text-[12px] text-ink-soft transition-colors hover:bg-ink/[0.05] hover:text-ink"
        >
          <ArrowLeft size={14} strokeWidth={2.2} />
          返回
        </button>
        <h1 className="ml-1 text-[13px] font-semibold text-ink">设置</h1>
      </header>

      <nav className="shrink-0 px-3">
        <div className="flex items-center gap-0.5 rounded-full bg-paper-2 p-[3px]">
          {TABS.map((item) => {
            const active = item.id === tab
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex-1 rounded-full py-[6px] text-[11px] transition-colors duration-200 ${
                  active
                    ? 'bg-surface font-semibold text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                    : 'font-medium text-ink-soft hover:text-ink'
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
        {tab === 'mode' ? <ModePanel /> : null}
        {tab === 'levels' ? <LevelsPanel /> : null}
        {tab === 'calibration' ? <CalibrationPanel /> : null}
        {tab === 'fullscreen' ? <FullscreenPanel /> : null}
        {tab === 'devices' ? <DevicesPanel onRestart={onRestartDevice} /> : null}
        {tab === 'system' ? <SystemPanel /> : null}
      </div>
    </div>
  )
}
