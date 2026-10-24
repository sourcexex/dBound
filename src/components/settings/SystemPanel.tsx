import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { useSettingsStore } from '../../stores/settings'
import { Row, SectionCard } from '../ui/SectionCard'

const APP_VERSION = '0.1.0'

export function SystemPanel() {
  const resetAll = useSettingsStore((state) => state.resetAll)
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="space-y-3">
      <SectionCard title="关于">
        <Row label="dBound" hint={`版本 ${APP_VERSION} · Windows 10 1809+ / 11`} />
        <Row label="读数说明" hint="本应用用麦克风响度估测分贝，数值用于比较相对大小，不能用于声学计量或法律用途。" />
        <Row label="隐私" hint="音频只在内存中计算 RMS，从不录制、不写入磁盘、不上传。" />
        <Row label="数据存储" hint="设置保存在本机 WebView 的 localStorage，卸载应用时一并清除。" />
      </SectionCard>

      <SectionCard title="重置">
        <Row
          label="恢复全部默认设置"
          hint="模式、级别、颜色、校准偏移、设备选择都会恢复为出厂值"
        >
          <button
            type="button"
            onClick={() => {
              if (!confirming) {
                setConfirming(true)
                return
              }
              resetAll()
              setConfirming(false)
            }}
            onBlur={() => setConfirming(false)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
              confirming
                ? 'border-[#DC2626]/30 bg-[#FEE2E2] text-[#B91C1C]'
                : 'border-line bg-white text-ink-soft hover:text-ink'
            }`}
          >
            <RotateCcw size={11.5} strokeWidth={2} />
            {confirming ? '再点一次确认' : '恢复默认'}
          </button>
        </Row>
      </SectionCard>

      <p className="px-1 text-center text-[10px] leading-relaxed text-ink-faint">
        dBound · 桌面音量哨兵
        <br />
        估测值仅供感知参考
      </p>
    </div>
  )
}
