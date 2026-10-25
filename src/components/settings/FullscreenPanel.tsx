import {
  DEFAULT_FULLSCREEN_SUBTITLE,
  DEFAULT_FULLSCREEN_TITLE,
  FULLSCREEN_SUBTITLE_MAX,
  FULLSCREEN_TITLE_MAX,
} from '../../lib/settingsSchema'
import { useSettingsStore } from '../../stores/settings'
import { SectionCard } from '../ui/SectionCard'

const INPUT_CLASS =
  'w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-ink/30'

export function FullscreenPanel() {
  const title = useSettingsStore((state) => state.fullscreenTitle)
  const subtitle = useSettingsStore((state) => state.fullscreenSubtitle)
  const setTitle = useSettingsStore((state) => state.setFullscreenTitle)
  const setSubtitle = useSettingsStore((state) => state.setFullscreenSubtitle)

  return (
    <div className="space-y-3">
      <SectionCard title="全屏标题" hint="显示在全屏模式左上角，适合写班级或场景名称">
        <label className="mb-2 block">
          <span className="mb-1 block text-[10.5px] text-ink-soft">标题</span>
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

        <label className="block">
          <span className="mb-1 block text-[10.5px] text-ink-soft">副标题</span>
          <input
            className={INPUT_CLASS}
            value={subtitle}
            maxLength={FULLSCREEN_SUBTITLE_MAX}
            placeholder={DEFAULT_FULLSCREEN_SUBTITLE}
            onChange={(event) => setSubtitle(event.target.value)}
          />
        </label>
        <p className="mt-1.5 text-[10px] text-ink-faint">副标题留空则不显示。</p>

        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setTitle(DEFAULT_FULLSCREEN_TITLE)
              setSubtitle(DEFAULT_FULLSCREEN_SUBTITLE)
            }}
            className="rounded-md px-2 py-1 text-[11px] text-ink-faint transition-colors hover:bg-black/[0.05] hover:text-ink"
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
              <div className="truncate text-[16px] leading-tight font-semibold text-ink">
                {title.trim() || DEFAULT_FULLSCREEN_TITLE}
              </div>
              {subtitle.trim() ? (
                <div className="mt-0.5 truncate text-[11px] font-medium text-ink-soft">
                  {subtitle}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
