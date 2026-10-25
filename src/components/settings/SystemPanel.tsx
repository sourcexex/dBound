import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { THEME_OPTIONS } from '../../lib/theme'
import { useSettingsStore } from '../../stores/settings'
import { Toggle } from '../ui/Toggle'
import { Row, SectionCard } from '../ui/SectionCard'

const APP_VERSION = '0.1.0'

export function SystemPanel() {
  const resetAll = useSettingsStore((state) => state.resetAll)
  const theme = useSettingsStore((state) => state.theme)
  const darkMode = useSettingsStore((state) => state.darkMode)
  const setTheme = useSettingsStore((state) => state.setTheme)
  const setDarkMode = useSettingsStore((state) => state.setDarkMode)
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="space-y-3">
      <SectionCard title="外观" hint="选择浅色主题，或切换暗黑模式">
        <div className="grid grid-cols-2 gap-2">
          {THEME_OPTIONS.map((option) => {
            const selected = theme === option.id
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setTheme(option.id)}
                className={`rounded-xl border p-2 text-left transition-colors ${
                  selected ? 'border-ink/25 bg-surface' : 'border-line bg-surface/60 hover:border-ink/15'
                }`}
              >
                <span
                  className="block h-10 w-full rounded-lg"
                  style={{ background: option.preview }}
                />
                <span className="mt-1.5 flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-ink">{option.label}</span>
                  <span
                    className={`grid h-3.5 w-3.5 place-items-center rounded-full border ${
                      selected ? 'border-ink bg-ink' : 'border-[#C9C8C1]'
                    }`}
                  >
                    {selected ? <span className="h-1 w-1 rounded-full bg-paper" /> : null}
                  </span>
                </span>
                <span className="mt-0.5 block text-[10px] leading-relaxed text-ink-faint">
                  {option.hint}
                </span>
              </button>
            )
          })}
        </div>
        <div className="mt-2">
          <Row label="暗黑模式" hint="深色背景 + 浅色文字，夜间更护眼">
            <Toggle checked={darkMode} label="暗黑模式" onChange={setDarkMode} />
          </Row>
        </div>
      </SectionCard>

      <SectionCard title="关于">
        <Row label="dBound" hint={`版本 ${APP_VERSION} · Windows 10 1809+ / 11`} />
        <Row label="读数说明" hint="本应用用麦克风响度估测分贝，数值用于比较相对大小，不能用于声学计量或法律用途。" />
        <Row label="隐私" hint="音频只在内存中计算 RMS，从不录制、不写入磁盘、不上传。" />
        <Row label="数据存储" hint="设置保存在本机 WebView 的 localStorage，卸载应用时一并清除。" />
      </SectionCard>

      <SectionCard title="重置">
        <Row
          label="恢复全部默认设置"
          hint="模式、级别、颜色、校准偏移、设备选择都会恢复为出厂值"
        >
          <button
            type="button"
            onClick={() => {
              if (!confirming) {
                setConfirming(true)
                return
              }
              resetAll()
              setConfirming(false)
            }}
            onBlur={() => setConfirming(false)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
              confirming
                ? 'border-[#DC2626]/30 bg-[#FEE2E2] text-[#B91C1C]'
                : 'border-line bg-surface text-ink-soft hover:text-ink'
            }`}
          >
            <RotateCcw size={11.5} strokeWidth={2} />
            {confirming ? '再点一次确认' : '恢复默认'}
          </button>
        </Row>
      </SectionCard>

      <p className="px-1 text-center text-[10px] leading-relaxed text-ink-faint">
        dBound · 桌面音量哨兵
        <br />
        估测值仅供感知参考
      </p>
    </div>
  )
}
