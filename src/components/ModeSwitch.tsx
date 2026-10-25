import type { Mode } from '../lib/types'

export function ModeSwitch({
  mode,
  labels,
  onChange,
}: {
  mode: Mode
  labels: Record<Mode, string>
  onChange: (mode: Mode) => void
}) {
  const options: Array<{ value: Mode; label: string; hint: string }> = [
    { value: 'forward', label: labels.forward, hint: '太吵报警' },
    { value: 'reverse', label: labels.reverse, hint: '太小声报警' },
  ]

  return (
    <div className="flex justify-center">
      <div className="relative flex w-[248px] items-center rounded-full bg-paper-2 p-[3px]">
        <span
          aria-hidden
          className="absolute top-[3px] bottom-[3px] left-[3px] w-[calc(50%-3px)] rounded-full bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.06),0_1px_6px_rgba(0,0,0,0.04)] transition-transform duration-200 ease-out"
          style={{ transform: mode === 'reverse' ? 'translateX(100%)' : 'translateX(0)' }}
        />
        {options.map((option) => {
          const active = option.value === mode
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              title={option.hint}
              className={`relative z-10 flex-1 truncate rounded-full px-2 py-[6px] text-[12.5px] transition-colors duration-200 ${
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
