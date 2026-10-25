import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { isTauri } from '../lib/tauri'

/** Full-window activation gate shown when the installer's serial marker is missing. */
export function ActivationPage({ onActivated }: { onActivated: () => void }) {
  const [serial, setSerial] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (busy) return
    const value = serial.trim()
    if (!value) {
      setError('请输入安装序列号。')
      return
    }
    setBusy(true)
    setError('')
    try {
      if (!isTauri()) {
        onActivated()
        return
      }
      const { invoke } = await import('@tauri-apps/api/core')
      const ok = await invoke<boolean>('activate_license', { serial: value })
      if (ok) {
        onActivated()
      } else {
        setError('序列号不正确，请检查后重试。')
      }
    } catch {
      setError('激活失败，请稍后重试。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full w-full items-center justify-center px-6">
      <div className="dbound-rise w-full max-w-[300px] rounded-2xl border border-line bg-surface/92 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.16)]">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-ink text-paper">
            <ShieldCheck size={16} strokeWidth={2.2} />
          </span>
          <div>
            <div className="text-[13px] font-semibold text-ink">dBound 激活</div>
            <div className="text-[10px] text-ink-faint">版本 1.0.1 Beta2</div>
          </div>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-ink-soft">
          当前设备尚未激活。请输入安装时使用的序列号，验证通过后即可使用。
        </p>

        <input
          autoFocus
          value={serial}
          onChange={(event) => {
            setSerial(event.target.value)
            setError('')
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void submit()
          }}
          placeholder="请输入序列号"
          className="mt-3 w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-[12px] tracking-[0.14em] text-ink outline-none transition-colors placeholder:tracking-normal placeholder:text-ink-faint focus:border-ink/30"
        />

        {error ? <p className="mt-1.5 text-[10.5px] text-[#DC2626]">{error}</p> : null}

        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="mt-3 w-full rounded-lg bg-ink py-2 text-[12px] font-semibold text-paper transition-opacity disabled:opacity-60"
        >
          {busy ? '验证中…' : '激活'}
        </button>

        <p className="mt-3 text-center text-[9.5px] leading-relaxed text-ink-faint">
          序列号仅用于本机校验，不会上传。分发给他人前请确认授权范围。
        </p>
      </div>
    </div>
  )
}
