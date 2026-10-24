import type { Mode } from '../lib/types'

const OPTIONS: Array<{ value: Mode; label: string; hint: string }> = [
  { value: 'forward', label: '正向', hint: '太吵报警' },
  { value: 'reverse', label: '反向', hint: '太小声报警' },
]

export function ModeSwitch({
  mode,
  onChange,
}: {
  mode: Mode
  onChange: (mode: Mode) => void
}) {
  return (
    <div className="flex justify-center">
      <div className="relative flex w-[232px] items-center rounded-full bg-paper-2 p-[3px]">
        <span
          aria-hidden
          className="absolute top-[3px] bottom-[3px] left-[3px] w-[calc(50%-3px)] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06),0_1px_6px_rgba(0,0,0,0.04)] transition-transform duration-200 ease-out"
          style={{ transform: mode === 'reverse' ? 'translateX(100%)' : 'translateX(0)' }}
        />
        {OPTIONS.map((option) => {
          const active = option.value === mode
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              title={option.hint}
              className={`relative z-10 flex-1 rounded-full py-[6px] text-[12.5px] transition-colors duration-200 ${
                active ? 'font-semibold text-ink' : 'font-medium text-ink-soft hover:text-ink'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
