import type { ReactNode } from 'react'

export function SectionCard({
  title,
  hint,
  children,
  action,
}: {
  title: string
  hint?: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section
      className="rounded-xl border border-black/[0.06] bg-surface/80 p-3.5"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '360px' }}
    >
      <div className="mb-2.5 flex items-center justify-between">
        <div>
          <h3 className="text-[12.5px] font-semibold text-ink">{title}</h3>
          {hint ? <p className="mt-0.5 text-[10.5px] text-ink-faint">{hint}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Row({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <div className="text-[12px] font-medium text-ink">{label}</div>
        {hint ? <div className="mt-0.5 text-[10.5px] leading-relaxed text-ink-faint">{hint}</div> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
