import { useState } from 'react'
import { ChevronDown, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { sortLevels, validateLevels } from '../../lib/dsp'
import { LEVEL_PALETTE } from '../../lib/presets'
import {
  LEVEL_NAME_SIZE_MAX,
  LEVEL_NAME_SIZE_MIN,
  LEVEL_NOTE_SIZE_MAX,
  LEVEL_NOTE_SIZE_MIN,
} from '../../lib/settingsSchema'
import type { Level } from '../../lib/types'
import { useLevelStore } from '../../stores/level'
import { useSettingsStore } from '../../stores/settings'
import { accentFallback } from '../../lib/theme'
import { Toggle } from '../ui/Toggle'
import { ThresholdScale } from './ThresholdScale'
import { ValueSlider } from '../ui/ValueSlider'

const inputClass =
  'w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] text-ink outline-none transition-colors focus:border-ink/30'

function ColorSwatches({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {LEVEL_PALETTE.map((color) => {
        const selected = color.toLowerCase() === value.toLowerCase()
        return (
          <button
            key={color}
            type="button"
            aria-label={`颜色 ${color}`}
            onClick={() => onChange(color)}
            className={`h-[19px] w-[19px] rounded-full transition-transform duration-150 ${
              selected ? 'scale-110 ring-2 ring-ink/45 ring-offset-1' : 'hover:scale-105'
            }`}
            style={{ backgroundColor: color }}
          />
        )
      })}
    </div>
  )
}

function LevelRow({
  level,
  mode,
  expanded,
  onToggleExpand,
  onUpdate,
  onRemove,
  canRemove,
}: {
  level: Level
  mode: 'forward' | 'reverse'
  expanded: boolean
  onToggleExpand: () => void
  onUpdate: (patch: Partial<Level>) => void
  onRemove: () => void
  canRemove: boolean
}) {
  const symbol = mode === 'forward' ? '≥' : '≤'

  return (
    <div
      className={`rounded-xl border bg-surface/85 transition-colors ${
        expanded ? 'border-black/[0.1]' : 'border-black/[0.06]'
      }`}
    >
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <span
          className="h-[9px] w-[9px] shrink-0 rounded-full"
          style={{ backgroundColor: level.color, opacity: level.enabled ? 1 : 0.35 }}
        />
        <button type="button" onClick={onToggleExpand} className="min-w-0 flex-1 text-left">
          <div className="flex items-baseline gap-2">
            <span className={`text-[12.5px] font-semibold ${level.enabled ? 'text-ink' : 'text-ink-faint'}`}>
              {level.name || '未命名'}
            </span>
            <span className="num text-[11px] text-ink-soft">
              {symbol} {level.threshold.toFixed(1)} dB
            </span>
          </div>
          <div className="mt-0.5 truncate text-[10.5px] text-ink-faint">
            {level.note || '未设置提示文字'}
          </div>
        </button>
        <Toggle
          checked={level.enabled}
          label={`启用 ${level.name}`}
          onChange={(enabled) => onUpdate({ enabled })}
        />
        <button
          type="button"
          onClick={onToggleExpand}
          aria-label="展开编辑"
          className="grid h-6 w-6 place-items-center rounded-md text-ink-faint transition-colors hover:bg-ink/[0.05] hover:text-ink"
        >
          <ChevronDown
            size={13}
            strokeWidth={2.2}
            className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {expanded ? (
        <div className="space-y-2.5 border-t border-black/[0.05] px-3 py-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-[10.5px] text-ink-soft">
              <span>触发阈值</span>
              <span className="num font-medium text-ink">{level.threshold.toFixed(1)} dB</span>
            </div>
            <input
              type="range"
              className="dbound-range"
              min={0}
              max={120}
              step={0.5}
              value={level.threshold}
              onChange={(event) => onUpdate({ threshold: Number(event.target.value) })}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-[10.5px] text-ink-soft">名称</span>
              <input
                className={inputClass}
                value={level.name}
                maxLength={8}
                placeholder="警告"
                onChange={(event) => onUpdate({ name: event.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10.5px] text-ink-soft">提示文字</span>
              <input
                className={inputClass}
                value={level.note}
                maxLength={30}
                placeholder="声音偏大，注意一下"
                onChange={(event) => onUpdate({ note: event.target.value })}
              />
            </label>
          </div>

          <div>
            <div className="mb-1.5 text-[10.5px] text-ink-soft">颜色</div>
            <ColorSwatches value={level.color} onChange={(color) => onUpdate({ color })} />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={!canRemove}
              onClick={onRemove}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-ink-faint transition-colors enabled:hover:bg-[#FEE2E2] enabled:hover:text-[#DC2626] disabled:opacity-40"
            >
              <Trash2 size={11.5} strokeWidth={2} />
              删除这一级
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function LevelsPanel() {
  const mode = useSettingsStore((state) => state.mode)
  const modeLabels = useSettingsStore((state) => state.modeLabels)
  const levels = useSettingsStore((state) => state.levels[state.mode])
  const updateLevel = useSettingsStore((state) => state.updateLevel)
  const addLevel = useSettingsStore((state) => state.addLevel)
  const removeLevel = useSettingsStore((state) => state.removeLevel)
  const resetLevels = useSettingsStore((state) => state.resetLevels)
  const levelNameSize = useSettingsStore((state) => state.levelNameSize)
  const levelNoteSize = useSettingsStore((state) => state.levelNoteSize)
  const setLevelNameSize = useSettingsStore((state) => state.setLevelNameSize)
  const setLevelNoteSize = useSettingsStore((state) => state.setLevelNoteSize)

  const db = useLevelStore((state) => state.db)
  const activeLevel = useLevelStore((state) => state.activeLevel)

  const [expanded, setExpanded] = useState<string | null>(null)

  const sorted = sortLevels(mode, levels)
  const problem = validateLevels(mode, sorted)
  const darkMode = useSettingsStore((state) => state.darkMode)
  const accent = activeLevel?.color ?? accentFallback(darkMode)
  const orderedForScale = [...levels].sort((a, b) =>
    mode === 'forward' ? a.threshold - b.threshold : b.threshold - a.threshold,
  )

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-black/[0.06] bg-surface/80 p-3.5">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h3 className="text-[12.5px] font-semibold text-ink">
              {modeLabels[mode]} · {mode === 'forward' ? '越吵越严重' : '越安静越严重'}
            </h3>
            <p className="mt-0.5 text-[10.5px] text-ink-faint">
              当前读数 {db === null ? '—' : `${db.toFixed(1)} dB`}
              {activeLevel ? ` · 命中「${activeLevel.name}」` : ' · 未命中任何级别'}
            </p>
          </div>
          <span className="num rounded-md bg-paper-2 px-1.5 py-0.5 text-[10px] text-ink-soft">
            {levels.length}/8
          </span>
        </div>
        <ThresholdScale mode={mode} levels={orderedForScale} db={db} accent={accent} />
      </div>

      <div className="rounded-xl border border-black/[0.06] bg-surface/80 p-3.5">
        <h3 className="text-[12.5px] font-semibold text-ink">级别文字大小</h3>
        <p className="mt-0.5 text-[10.5px] leading-relaxed text-ink-faint">
          命中级别时，主界面胶囊与全屏状态行里的「级别名称 / 提示文字」字号
        </p>
        <div className="mt-2 space-y-3">
          <ValueSlider
            label="名称字号"
            value={levelNameSize}
            min={LEVEL_NAME_SIZE_MIN}
            max={LEVEL_NAME_SIZE_MAX}
            step={1}
            unit="px"
            onChange={setLevelNameSize}
          />
          <ValueSlider
            label="提示文字字号"
            value={levelNoteSize}
            min={LEVEL_NOTE_SIZE_MIN}
            max={LEVEL_NOTE_SIZE_MAX}
            step={1}
            unit="px"
            onChange={setLevelNoteSize}
          />
        </div>
      </div>

      {problem ? (
        <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-[11px] text-[#B45309]">
          {problem}
        </div>
      ) : null}

      <div className="space-y-2">
        {sorted.map((level) => (
          <LevelRow
            key={level.id}
            level={level}
            mode={mode}
            expanded={expanded === level.id}
            onToggleExpand={() => setExpanded(expanded === level.id ? null : level.id)}
            onUpdate={(patch) => updateLevel(mode, level.id, patch)}
            onRemove={() => removeLevel(mode, level.id)}
            canRemove={levels.length > 1}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={levels.length >= 8}
          onClick={() => addLevel(mode)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-dashed border-black/15 py-2 text-[11.5px] font-medium text-ink-soft transition-colors enabled:hover:border-ink/30 enabled:hover:text-ink disabled:opacity-40"
        >
          <Plus size={12.5} strokeWidth={2.2} />
          添加一级
        </button>
        <button
          type="button"
          onClick={() => {
            resetLevels(mode)
            setExpanded(null)
          }}
          className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-[11.5px] text-ink-soft transition-colors hover:text-ink"
        >
          <RotateCcw size={12} strokeWidth={2} />
          默认
        </button>
      </div>
    </div>
  )
}
