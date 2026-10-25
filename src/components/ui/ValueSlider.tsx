export function ValueSlider({
  label,
  hint,
  value,
  min,
  max,
  step,
  unit,
  disabled = false,
  onChange,
}: {
  label: string
  hint?: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  disabled?: boolean
  onChange: (value: number) => void
}) {
  return (
    <div className={disabled ? 'opacity-45' : ''}>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[11.5px] font-medium text-ink">{label}</span>
        <span className="num text-[11px] text-ink-soft">
          {value} {unit}
        </span>
      </div>
      <input
        type="range"
        className="dbound-range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {hint ? <p className="mt-0.5 text-[10px] leading-relaxed text-ink-faint">{hint}</p> : null}
    </div>
  )
}
