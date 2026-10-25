import { DEFAULT_MODE_LABELS, MODE_LABEL_MAX } from '../../lib/settingsSchema'
import type { Mode } from '../../lib/types'
import { useSettingsStore } from '../../stores/settings'
import { Row, SectionCard } from '../ui/SectionCard'
import { Toggle } from '../ui/Toggle'

const MODE_COPY = {
  forward: {
    subtitle: '太吵时报警',
    detail: '读数高于某级阈值并持续 2 秒，触发该级提醒；峰值越高，命中的级别越严重。',
  },
  reverse: {
    subtitle: '太小声时报警',
    detail: '读数低于某级阈值并持续 2 秒，触发该级提醒；阈值越低，命中的级别越严重。',
  },
} as const

const INPUT_CLASS =
  'w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12px] text-ink outline-none transition-colors focus:border-ink/30'

export function ModePanel() {
  const mode = useSettingsStore((state) => state.mode)
  const modeLabels = useSettingsStore((state) => state.modeLabels)
  const setMode = useSettingsStore((state) => state.setMode)
  const setModeLabel = useSettingsStore((state) => state.setModeLabel)
  const readingSmooth = useSettingsStore((state) => state.readingSmooth)
  const setReadingSmooth = useSettingsStore((state) => state.setReadingSmooth)
  const showPeak = useSettingsStore((state) => state.showPeak)
  const setShowPeak = useSettingsStore((state) => state.setShowPeak)

  return (
    <div className="space-y-3">
      <SectionCard title="模式名称" hint="显示在主界面切换器、全屏与日志里，最多 8 个字">
        <div className="grid grid-cols-2 gap-2">
          {(['forward', 'reverse'] as Mode[]).map((key) => (
            <label key={key} className="block">
              <span className="mb-1 block text-[10.5px] text-ink-soft">
                {key === 'forward' ? '正向（越吵越严重）' : '反向（越安静越严重）'}
              </span>
              <input
                className={INPUT_CLASS}
                value={modeLabels[key]}
                maxLength={MODE_LABEL_MAX}
                placeholder={DEFAULT_MODE_LABELS[key]}
                onChange={(event) => setModeLabel(key, event.target.value)}
                onBlur={() => {
                  if (!modeLabels[key].trim()) setModeLabel(key, DEFAULT_MODE_LABELS[key])
                }}
              />
            </label>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-[10px] text-ink-faint">例如：正向改成「自习课模式」，反向改成「早读模式」</p>
          <button
            type="button"
            onClick={() => {
              setModeLabel('forward', DEFAULT_MODE_LABELS.forward)
              setModeLabel('reverse', DEFAULT_MODE_LABELS.reverse)
            }}
            className="shrink-0 rounded-md px-2 py-1 text-[11px] text-ink-faint transition-colors hover:bg-black/[0.05] hover:text-ink"
          >
            恢复默认
          </button>
        </div>
      </SectionCard>

      <SectionCard title="工作模式">
        <div className="space-y-2">
          {(Object.keys(MODE_COPY) as Array<keyof typeof MODE_COPY>).map((key) => {
            const copy = MODE_COPY[key]
            const selected = mode === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  selected
                    ? 'border-ink/25 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)]'
                    : 'border-line bg-white/50 hover:border-ink/15'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] font-semibold text-ink">{modeLabels[key]}</span>
                  <span
                    className={`grid h-4 w-4 place-items-center rounded-full border ${
                      selected ? 'border-ink bg-ink' : 'border-[#C9C8C1]'
                    }`}
                  >
                    {selected ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                  </span>
                </div>
                <div className="mt-0.5 text-[10.5px] font-medium text-ink-soft">{copy.subtitle}</div>
                <p className="mt-1 text-[10.5px] leading-relaxed text-ink-faint">{copy.detail}</p>
              </button>
            )
          })}
        </div>
      </SectionCard>

      <SectionCard title="读数行为">
        <Row
          label="朗读平滑（3 秒）"
          hint="反向模式专用：跟随句子而不是音节，避免读数闪红"
        >
          <Toggle
            checked={readingSmooth}
            label="朗读平滑"
            onChange={setReadingSmooth}
          />
        </Row>
        <Row label="显示峰值" hint="在大数字下方显示最近 3 秒的最高读数">
          <Toggle checked={showPeak} label="显示峰值" onChange={setShowPeak} />
        </Row>
      </SectionCard>

      <SectionCard title="防抖参数" hint="固定规则，暂不开放调整">
        <Row label="触发持续" hint="越界需保持这么久才报警" >
          <span className="num text-[11.5px] text-ink-soft">2.0 s</span>
        </Row>
        <Row label="回落滞回" hint="恢复后需再回到阈值内这么多 dB">
          <span className="num text-[11.5px] text-ink-soft">3.0 dB</span>
        </Row>
        <Row label="解除持续" hint="回落状态需保持这么久才解除">
          <span className="num text-[11.5px] text-ink-soft">1.0 s</span>
        </Row>
      </SectionCard>
    </div>
  )
}
