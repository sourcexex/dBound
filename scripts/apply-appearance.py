"""Make readout fallbacks dark-aware and add the appearance card."""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def patch(relative: str, pairs: list[tuple[str, str]], count_one: bool = True) -> None:
    path = ROOT / relative
    text = path.read_text(encoding="utf-8")
    for old, new in pairs:
        if old not in text:
            raise SystemExit(f"anchor not found in {relative}: {old[:70]!r}")
        text = text.replace(old, new, 1 if count_one else -1)
    path.write_text(text, encoding="utf-8")
    print(f"patched {relative}")


patch(
    "src/components/Gauge.tsx",
    [
        (
            "  const accent = activeLevel?.color ?? '#17171A'",
            "  const darkMode = useSettingsStore((state) => state.darkMode)\n"
            "  const accent = activeLevel?.color ?? accentFallback(darkMode)",
        ),
        (
            "style={{ backgroundColor: activeLevel ? accent : '#C7C6BE' }}",
            "style={{ backgroundColor: activeLevel ? accent : mutedFallback(darkMode) }}",
        ),
        (
            'className="num text-[54px] leading-none font-semibold tracking-[0.08em] text-[#CFCEC7]"',
            'className="num text-[54px] leading-none font-semibold tracking-[0.08em] text-ink-faint"',
        ),
        (
            "import { useSettingsStore } from '../stores/settings'",
            "import { useSettingsStore } from '../stores/settings'\n"
            "import { accentFallback, mutedFallback } from '../lib/theme'",
        ),
    ],
)

patch(
    "src/pages/MainPage.tsx",
    [
        (
            "  const accent = activeLevel?.color ?? '#17171A'",
            "  const darkMode = useSettingsStore((state) => state.darkMode)\n"
            "  const accent = activeLevel?.color ?? accentFallback(darkMode)",
        ),
        (
            "import { useSettingsStore } from '../stores/settings'",
            "import { useSettingsStore } from '../stores/settings'\n"
            "import { accentFallback } from '../lib/theme'",
        ),
    ],
)

patch(
    "src/components/settings/LevelsPanel.tsx",
    [
        (
            "  const accent = activeLevel?.color ?? '#17171A'",
            "  const darkMode = useSettingsStore((state) => state.darkMode)\n"
            "  const accent = activeLevel?.color ?? accentFallback(darkMode)",
        ),
        (
            "import { useSettingsStore } from '../../stores/settings'",
            "import { useSettingsStore } from '../../stores/settings'\n"
            "import { accentFallback } from '../../lib/theme'",
        ),
    ],
)

# SystemPanel: appearance card
path = ROOT / "src/components/settings/SystemPanel.tsx"
text = path.read_text(encoding="utf-8")
text = text.replace(
    "import { useSettingsStore } from '../../stores/settings'",
    "import { THEME_OPTIONS } from '../../lib/theme'\n"
    "import { useSettingsStore } from '../../stores/settings'\n"
    "import { Toggle } from '../ui/Toggle'",
    1,
)
text = text.replace(
    "  const resetAll = useSettingsStore((state) => state.resetAll)\n  const [confirming, setConfirming] = useState(false)",
    "  const resetAll = useSettingsStore((state) => state.resetAll)\n"
    "  const theme = useSettingsStore((state) => state.theme)\n"
    "  const darkMode = useSettingsStore((state) => state.darkMode)\n"
    "  const setTheme = useSettingsStore((state) => state.setTheme)\n"
    "  const setDarkMode = useSettingsStore((state) => state.setDarkMode)\n"
    "  const [confirming, setConfirming] = useState(false)",
    1,
)
appearance = '''      <SectionCard title="外观" hint="选择浅色主题，或切换暗黑模式">
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

'''
anchor = '      <SectionCard title="关于">'
text = text.replace(anchor, appearance + anchor, 1)
path.write_text(text, encoding="utf-8")
print("patched src/components/settings/SystemPanel.tsx")
