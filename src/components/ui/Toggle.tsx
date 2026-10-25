export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation()
        onChange(!checked)
      }}
      className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-200 ${
        checked ? 'bg-ink' : 'bg-ink/15'
      }`}
    >
      <span
        className={`absolute top-[3px] left-[3px] h-4 w-4 rounded-full bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.22)] transition-transform duration-200 ${
          checked ? 'translate-x-[16px]' : 'translate-x-0'
        }`}
      />
    </button>
  )
}
