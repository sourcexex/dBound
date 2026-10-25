"""Apply theme/dark-mode plumbing to the fullscreen and mini windows."""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def patch(relative: str, pairs: list[tuple[str, str]]) -> None:
    path = ROOT / relative
    text = path.read_text(encoding="utf-8")
    for old, new in pairs:
        if old not in text:
            raise SystemExit(f"anchor not found in {relative}: {old[:60]!r}")
        text = text.replace(old, new, 1)
    path.write_text(text, encoding="utf-8")
    print(f"patched {relative}")


patch(
    "src/pages/FullPage.tsx",
    [
        (
            "  mode: 'forward',\n  modeLabel: '正向',",
            "  mode: 'forward',\n  theme: 'aurora',\n  darkMode: false,\n  modeLabel: '正向',",
        ),
        (
            '      className="relative h-screen w-screen overflow-hidden"\n    >\n      <AuroraBackground variant="fullscreen" />',
            '      data-appearance={state.darkMode ? \'dark\' : \'light\'}\n      data-theme={state.theme}\n      className="relative h-screen w-screen overflow-hidden"\n    >\n      <AuroraBackground variant="fullscreen" theme={state.theme} dark={state.darkMode} />',
        ),
        (
            "  const accent = state.name ? state.color : '#17171A'",
            "  const accent = state.name ? state.color : accentFallback(state.darkMode)\n"
            "  const titleColor =\n"
            "    state.darkMode && state.titleColor.toLowerCase() === '#17171a' ? '#F2F3F1' : state.titleColor\n"
            "  const subtitleColor =\n"
            "    state.darkMode && state.subtitleColor.toLowerCase() === '#6b6b72' ? '#A4A6AD' : state.subtitleColor",
        ),
        ("                color: state.titleColor,", "                color: titleColor,"),
        ("                  color: state.subtitleColor,", "                  color: subtitleColor,"),
        (
            "style={{ color: measuring ? accent : '#A9A8A1' }}",
            "style={{ color: measuring ? accent : dimmedNumber(state.darkMode) }}",
        ),
        (
            "style={{ backgroundColor: state.name ? accent : '#C7C6BE' }}",
            "style={{ backgroundColor: state.name ? accent : mutedFallback(state.darkMode) }}",
        ),
        (
            "backgroundColor: measuring ? accent : '#17171A',",
            "backgroundColor: measuring ? accent : accentFallback(state.darkMode),",
        ),
        (
            'className="num font-semibold tracking-[0.06em] text-[#CBCAC3]"',
            'className="num font-semibold tracking-[0.06em] text-ink-faint"',
        ),
        (
            "import { fontStackFor } from '../lib/titleFonts'",
            "import { accentFallback, dimmedNumber, mutedFallback } from '../lib/theme'\n"
            "import { fontStackFor } from '../lib/titleFonts'",
        ),
    ],
)

patch(
    "src/pages/MiniPage.tsx",
    [
        (
            "  mode: 'forward',\n  modeLabel: '正向',",
            "  mode: 'forward',\n  theme: 'aurora',\n  darkMode: false,\n  modeLabel: '正向',",
        ),
        (
            "  const accent = state.name ? state.color : '#17171A'",
            "  const accent = state.name ? state.color : accentFallback(state.darkMode)",
        ),
        (
            "style={{ color: measuring ? (state.name ? accent : '#17171A') : '#9C9B94' }}",
            "style={{ color: measuring ? accent : dimmedNumber(state.darkMode) }}",
        ),
        (
            "style={{ backgroundColor: measuring ? (state.name ? accent : '#B9B8B0') : '#D3D2CB' }}",
            "style={{ backgroundColor: measuring ? (state.name ? accent : mutedFallback(state.darkMode)) : 'var(--color-line)' }}",
        ),
        (
            "import { isTauri } from '../lib/tauri'",
            "import { accentFallback, dimmedNumber, mutedFallback } from '../lib/theme'\n"
            "import { isTauri } from '../lib/tauri'",
        ),
        (
            "    <div\n      data-tauri-drag-region\n      onClick={openMain}",
            "    <div\n      data-tauri-drag-region\n      data-appearance={state.darkMode ? 'dark' : 'light'}\n      data-theme={state.theme}\n      onClick={openMain}",
        ),
    ],
)
