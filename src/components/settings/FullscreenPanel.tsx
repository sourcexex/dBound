import {
  DEFAULT_FULLSCREEN_SUBTITLE,
  DEFAULT_FULLSCREEN_TITLE,
  FULLSCREEN_SUBTITLE_MAX,
  FULLSCREEN_TITLE_MAX,
} from '../../lib/settingsSchema'
import {
  DEFAULT_TITLE_COLOR,
  DEFAULT_TITLE_FONT,
  DEFAULT_TITLE_SIZE,
  TITLE_FONTS,
  TITLE_SIZE_MAX,
  TITLE_SIZE_MIN,
  fontStackFor,
} from '../../lib/titleFonts'
import { useSettingsStore } from '../../stores/settings'
import { SectionCard } from '../ui/SectionCard'

const INPUT_CLASS =
  'w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-ink/30'

const LABEL_CLASS = 'mb-1 block text-[10.5px] text-ink-soft'

export function FullscreenPanel() {
  const title = useSettingsStore((state) => state.fullscreenTitle)
  const subtitle = useSettingsStore((state) => state.fullscreenSubtitle)
  const font = useSettingsStore((state) => state.fullscreenTitleFont)
  const size = useSettingsStore((state) => state.fullscreenTitleSize)
  const color = useSettingsStore((state) => state.fullscreenTitleColor)

  const setTitle = useSettingsStore((state) => state.setFullscreenTitle)
  const setSubtitle = useSettingsStore((state) => state.setFullscreenSubtitle)
  const setFont = useSettingsStore((state) => state.setFullscreenTitleFont)
  const setSize = useSettingsStore((state) => state.setFullscreenTitleSize)
  const setColor = useSettingsStore((state) => state.setFullscreenTitleColor)

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
            <span className={LABEL_CLASS}>字体</span>
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

          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-[10.5px] text-ink-soft">字号</span>
              <span className="num text-[11px] font-medium text-ink">{size}px</span>
            </div>
            <input
              type="range"
              className="dbound-range"
              min={TITLE_SIZE_MIN}
              max={TITLE_SIZE_MAX}
              step={1}
              value={size}
              onChange={(event) => setSize(Number(event.target.value))}
            />
          </div>
        </div>

        <div className="mb-2">
          <span className={LABEL_CLASS}>颜色</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {['#17171A', '#DC2626', '#EA580C', '#CA8A04', '#16A34A', '#0891B2', '#2563EB', '#7C3AED'].map(
              (item) => (
                <button
                  key={item}
                  type="button"
                  aria-label={`颜色 ${item}`}
                  onClick={() => setColor(item)}
                  className={`h-[18px] w-[18px] rounded-full transition-transform duration-150 ${
                    color.toLowerCase() === item.toLowerCase()
                      ? 'scale-110 ring-2 ring-ink/45 ring-offset-1'
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: item }}
                />
              ),
            )}
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
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
            <span className="num ml-1 text-[10.5px] text-ink-faint">{color.toUpperCase()}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-[10px] text-ink-faint">副标题留空则不显示，字号随标题自动缩放。</p>
          <button
            type="button"
            onClick={() => {
              setTitle(DEFAULT_FULLSCREEN_TITLE)
              setSubtitle(DEFAULT_FULLSCREEN_SUBTITLE)
              setFont(DEFAULT_TITLE_FONT)
              setSize(DEFAULT_TITLE_SIZE)
              setColor(DEFAULT_TITLE_COLOR)
            }}
            className="shrink-0 rounded-md px-2 py-1 text-[11px] text-ink-faint transition-colors hover:bg-black/[0.05] hover:text-ink"
          >
            恢复默认
          </button>
        </div>
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
                style={{ fontFamily: stack, fontSize: `${size}px`, color }}
              >
                {previewTitle}
              </div>
              {previewSubtitle ? (
                <div
                  className="mt-1 truncate font-medium text-ink-soft"
                  style={{
                    fontFamily: stack,
                    fontSize: `${Math.max(12, Math.round(size * 0.62))}px`,
                  }}
                >
                  {previewSubtitle}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <p className="mt-2 text-[10px] text-ink-faint">
          提示：颜色同时用于标题文字；若选了深色底图请改用浅色。
        </p>
      </SectionCard>
    </div>
  )
}
