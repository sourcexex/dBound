import type { ReactNode } from 'react'
import {
  DEFAULT_FULLSCREEN_SUBTITLE,
  DEFAULT_FULLSCREEN_TITLE,
  EMOJI_HOLD_MAX,
  EMOJI_HOLD_MIN,
  EMOJI_INITIAL_MAX,
  EMOJI_INITIAL_MIN,
  EMOJI_THRESHOLD_MAX,
  EMOJI_THRESHOLD_MIN,
  FULLSCREEN_SUBTITLE_MAX,
  FULLSCREEN_TITLE_MAX,
  IDLE_TEXT_MAX,
  STATUS_SIZE_MAX,
  STATUS_SIZE_MIN,
} from '../../lib/settingsSchema'
import type { Mode } from '../../lib/types'
import {
  DEFAULT_SUBTITLE_COLOR,
  DEFAULT_SUBTITLE_SIZE,
  DEFAULT_TITLE_COLOR,
  DEFAULT_TITLE_FONT,
  DEFAULT_TITLE_SIZE,
  SUBTITLE_SIZE_MAX,
  SUBTITLE_SIZE_MIN,
  TITLE_FONTS,
  TITLE_SIZE_MAX,
  TITLE_SIZE_MIN,
  fontStackFor,
} from '../../lib/titleFonts'
import { useSettingsStore } from '../../stores/settings'
import { SectionCard } from '../ui/SectionCard'
import { Toggle } from '../ui/Toggle'
import { ValueSlider } from '../ui/ValueSlider'

const INPUT_CLASS =
  'w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-ink/30'

const LABEL_CLASS = 'mb-1 block text-[10.5px] text-ink-soft'

const SWATCHES = [
  '#17171A',
  '#6B6B72',
  '#DC2626',
  '#EA580C',
  '#CA8A04',
  '#16A34A',
  '#0891B2',
  '#2563EB',
  '#7C3AED',
]

function ColorRow({
  value,
  onChange,
}: {
  value: string
  onChange: (color: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {SWATCHES.map((item) => (
        <button
          key={item}
          type="button"
          aria-label={`颜色 ${item}`}
          onClick={() => onChange(item)}
          className={`h-[18px] w-[18px] rounded-full transition-transform duration-150 ${
            value.toLowerCase() === item.toLowerCase()
              ? 'scale-110 ring-2 ring-ink/45 ring-offset-1'
              : 'hover:scale-105'
          }`}
          style={{ backgroundColor: item }}
        />
      ))}
      <label
        className="relative ml-1 grid h-[18px] w-[18px] cursor-pointer place-items-center overflow-hidden rounded-full border border-line"
        title="自定义颜色"
      >
        <span
          className="absolute inset-0"
          style={{
            background:
              'conic-gradient(#DC2626, #CA8A04, #16A34A, #0891B2, #2563EB, #7C3AED, #DC2626)',
          }}
        />
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
      <span className="num ml-1 text-[10.5px] text-ink-faint">{value.toUpperCase()}</span>
    </div>
  )
}

function SizeSlider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (size: number) => void
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[10.5px] text-ink-soft">{label}</span>
        <span className="num text-[11px] font-medium text-ink">{value}px</span>
      </div>
      <input
        type="range"
        className="dbound-range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  )
}

function GroupTitle({ children }: { children: ReactNode }) {
  return <div className="mt-3 mb-1.5 text-[10.5px] font-semibold text-ink">{children}</div>
}

export function FullscreenPanel() {
  const title = useSettingsStore((state) => state.fullscreenTitle)
  const subtitle = useSettingsStore((state) => state.fullscreenSubtitle)
  const font = useSettingsStore((state) => state.fullscreenTitleFont)
  const titleSize = useSettingsStore((state) => state.fullscreenTitleSize)
  const titleColor = useSettingsStore((state) => state.fullscreenTitleColor)
  const subtitleSize = useSettingsStore((state) => state.fullscreenSubtitleSize)
  const subtitleColor = useSettingsStore((state) => state.fullscreenSubtitleColor)

  const setTitle = useSettingsStore((state) => state.setFullscreenTitle)
  const setSubtitle = useSettingsStore((state) => state.setFullscreenSubtitle)
  const setFont = useSettingsStore((state) => state.setFullscreenTitleFont)
  const setTitleSize = useSettingsStore((state) => state.setFullscreenTitleSize)
  const setTitleColor = useSettingsStore((state) => state.setFullscreenTitleColor)
  const setSubtitleSize = useSettingsStore((state) => state.setFullscreenSubtitleSize)
  const setSubtitleColor = useSettingsStore((state) => state.setFullscreenSubtitleColor)
  const emoji = useSettingsStore((state) => state.emoji)
  const statusFont = useSettingsStore((state) => state.statusFont)
  const statusSize = useSettingsStore((state) => state.statusSize)
  const statusColor = useSettingsStore((state) => state.statusColor)
  const idleText = useSettingsStore((state) => state.idleText)
  const setStatusFont = useSettingsStore((state) => state.setStatusFont)
  const setStatusSize = useSettingsStore((state) => state.setStatusSize)
  const setStatusColor = useSettingsStore((state) => state.setStatusColor)
  const setIdleText = useSettingsStore((state) => state.setIdleText)
  const darkMode = useSettingsStore((state) => state.darkMode)
  const autoStatusColor = darkMode ? '#F2F3F1' : '#17171A'
  const modeLabels = useSettingsStore((state) => state.modeLabels)
  const updateEmojiRule = useSettingsStore((state) => state.updateEmojiRule)

  const previewTitle = title.trim() || DEFAULT_FULLSCREEN_TITLE
  const previewSubtitle = subtitle.trim()
  const stack = fontStackFor(font)

  return (
    <div className="space-y-3">
      <SectionCard title="全屏标题" hint="显示在全屏模式左上角，适合写班级或场景名称">
        <label className="mb-2 block">
          <span className={LABEL_CLASS}>标题</span>
          <input
            className={INPUT_CLASS}
            value={title}
            maxLength={FULLSCREEN_TITLE_MAX}
            placeholder={DEFAULT_FULLSCREEN_TITLE}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => {
              if (!title.trim()) setTitle(DEFAULT_FULLSCREEN_TITLE)
            }}
          />
        </label>

        <label className="mb-2.5 block">
          <span className={LABEL_CLASS}>副标题</span>
          <input
            className={INPUT_CLASS}
            value={subtitle}
            maxLength={FULLSCREEN_SUBTITLE_MAX}
            placeholder={DEFAULT_FULLSCREEN_SUBTITLE}
            onChange={(event) => setSubtitle(event.target.value)}
          />
        </label>

        <div className="mb-2.5 grid grid-cols-2 gap-2">
          <label className="block">
            <span className={LABEL_CLASS}>字体（标题与副标题共用）</span>
            <select
              className={INPUT_CLASS}
              value={font}
              onChange={(event) => setFont(event.target.value)}
              style={{ fontFamily: stack }}
            >
              {TITLE_FONTS.map((item) => (
                <option key={item.id} value={item.id} style={{ fontFamily: item.stack }}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <SizeSlider
            label="标题字号"
            value={titleSize}
            min={TITLE_SIZE_MIN}
            max={TITLE_SIZE_MAX}
            onChange={setTitleSize}
          />
        </div>

        <div className="mb-1">
          <span className={LABEL_CLASS}>标题颜色</span>
          <ColorRow value={titleColor} onChange={setTitleColor} />
        </div>

        <GroupTitle>副标题样式</GroupTitle>
        <SizeSlider
          label="副标题字号"
          value={subtitleSize}
          min={SUBTITLE_SIZE_MIN}
          max={SUBTITLE_SIZE_MAX}
          onChange={setSubtitleSize}
        />
        <div className="mt-2">
          <span className={LABEL_CLASS}>副标题颜色</span>
          <ColorRow value={subtitleColor} onChange={setSubtitleColor} />
        </div>

        <div className="mt-3 flex items-center justify-between">
          <p className="text-[10px] text-ink-faint">副标题留空则不显示。</p>
          <button
            type="button"
            onClick={() => {
              setTitle(DEFAULT_FULLSCREEN_TITLE)
              setSubtitle(DEFAULT_FULLSCREEN_SUBTITLE)
              setFont(DEFAULT_TITLE_FONT)
              setTitleSize(DEFAULT_TITLE_SIZE)
              setTitleColor(DEFAULT_TITLE_COLOR)
              setSubtitleSize(DEFAULT_SUBTITLE_SIZE)
              setSubtitleColor(DEFAULT_SUBTITLE_COLOR)
            }}
            className="shrink-0 rounded-md px-2 py-1 text-[11px] text-ink-faint transition-colors hover:bg-ink/[0.05] hover:text-ink"
          >
            恢复默认
          </button>
        </div>
      </SectionCard>

      <SectionCard title="状态文字" hint="大数字下方「安静 / 音量正常 / 级别名」文字，主界面与全屏共用">
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className={LABEL_CLASS}>字体</span>
            <select
              className={INPUT_CLASS}
              value={statusFont}
              onChange={(event) => setStatusFont(event.target.value)}
              style={{ fontFamily: fontStackFor(statusFont) }}
            >
              {TITLE_FONTS.map((item) => (
                <option key={item.id} value={item.id} style={{ fontFamily: item.stack }}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <SizeSlider
            label="字号"
            value={statusSize}
            min={STATUS_SIZE_MIN}
            max={STATUS_SIZE_MAX}
            onChange={setStatusSize}
          />
        </div>

        <div className="mt-2.5">
          <div className="mb-1 flex items-center justify-between">
            <span className={LABEL_CLASS}>颜色</span>
            <button
              type="button"
              onClick={() => setStatusColor('')}
              className="text-[10px] text-ink-faint transition-colors hover:text-ink"
            >
              自动
            </button>
          </div>
          <ColorRow value={statusColor || autoStatusColor} onChange={setStatusColor} />
          {!statusColor ? (
            <p className="mt-1 text-[9.5px] text-ink-faint">当前跟随文字色（自动）</p>
          ) : null}
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <label className="block">
            <span className={LABEL_CLASS}>自习课 · 未命中文字</span>
            <input
              className={INPUT_CLASS}
              value={idleText.forward}
              maxLength={IDLE_TEXT_MAX}
              onChange={(event) => setIdleText('forward', event.target.value)}
              placeholder="安静"
            />
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>早读模式 · 未命中文字</span>
            <input
              className={INPUT_CLASS}
              value={idleText.reverse}
              maxLength={IDLE_TEXT_MAX}
              onChange={(event) => setIdleText('reverse', event.target.value)}
              placeholder="音量正常"
            />
          </label>
        </div>
        <p className="mt-1.5 text-[9.5px] leading-relaxed text-ink-faint">
          未命中任何级别时显示这段文字；留空会恢复默认文案。
        </p>
      </SectionCard>

      <SectionCard title="表情互动" hint="达标后全屏底部随机蹦出一个表情，适合课堂激励">
        {(['reverse', 'forward'] as Mode[]).map((key) => {
          const rule = emoji[key]
          return (
            <div key={key} className={key === 'reverse' ? 'mb-3.5' : ''}>
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-ink">{modeLabels[key]}</div>
                  <div className="text-[10px] text-ink-faint">
                    {key === 'reverse'
                      ? `声音 ≥ ${rule.threshold} dB 时奖励`
                      : `保持 ≤ ${rule.threshold} dB 时奖励`}
                  </div>
                </div>
                <Toggle
                  checked={rule.enabled}
                  label={`${modeLabels[key]} 表情`}
                  onChange={(enabled) => updateEmojiRule(key, { enabled })}
                />
              </div>
              <div className={`mt-2 space-y-2.5 ${rule.enabled ? '' : 'opacity-45'}`}>
                <ValueSlider
                  label="触发分贝"
                  value={rule.threshold}
                  min={EMOJI_THRESHOLD_MIN}
                  max={EMOJI_THRESHOLD_MAX}
                  step={1}
                  unit="dB"
                  disabled={!rule.enabled}
                  onChange={(threshold) => updateEmojiRule(key, { threshold })}
                  hint={key === 'reverse' ? '高于此值算达标' : '低于此值算达标'}
                />
                <ValueSlider
                  label="持续时长"
                  value={rule.holdSeconds}
                  min={EMOJI_HOLD_MIN}
                  max={EMOJI_HOLD_MAX}
                  step={1}
                  unit="秒"
                  disabled={!rule.enabled}
                  onChange={(holdSeconds) => updateEmojiRule(key, { holdSeconds })}
                  hint="达标保持这么久，才冒出一个表情"
                />
                <ValueSlider
                  label="初始数量"
                  value={rule.initial}
                  min={EMOJI_INITIAL_MIN}
                  max={EMOJI_INITIAL_MAX}
                  step={1}
                  unit="个"
                  disabled={!rule.enabled}
                  onChange={(initial) => updateEmojiRule(key, { initial })}
                  hint="进入全屏时底部已有的表情数"
                />
              </div>
            </div>
          )
        })}
        <p className="text-[10px] leading-relaxed text-ink-faint">
          表情在切换模式时重新铺开，全屏期间持续累积；最多 80 个。
        </p>
      </SectionCard>

      <SectionCard title="预览" hint="全屏左上角的实际效果">
        <div className="rounded-xl border border-black/[0.05] bg-paper px-4 py-3.5">
          <div className="flex items-start gap-2.5">
            <span className="relative mt-[3px] grid h-5 w-5 shrink-0 place-items-center rounded-[7px] bg-ink">
              <span className="h-[7px] w-[7px] rounded-full bg-[#F2C94C]" />
            </span>
            <div className="min-w-0">
              <div
                className="truncate leading-tight font-semibold"
                style={{ fontFamily: stack, fontSize: `${titleSize}px`, color: titleColor }}
              >
                {previewTitle}
              </div>
              {previewSubtitle ? (
                <div
                  className="mt-1 truncate font-medium"
                  style={{
                    fontFamily: stack,
                    fontSize: `${subtitleSize}px`,
                    color: subtitleColor,
                  }}
                >
                  {previewSubtitle}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
