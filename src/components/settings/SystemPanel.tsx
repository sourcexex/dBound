import { useEffect, useState } from 'react'
import { FolderOpen, RotateCcw } from 'lucide-react'
import {
  POSTROLL_MAX,
  POSTROLL_MIN,
  PREROLL_MAX,
  PREROLL_MIN,
} from '../../lib/settingsSchema'
import { isTauri } from '../../lib/tauri'
import { THEME_OPTIONS } from '../../lib/theme'
import { useSettingsStore } from '../../stores/settings'
import { Toggle } from '../ui/Toggle'
import { Row, SectionCard } from '../ui/SectionCard'
import { ValueSlider } from '../ui/ValueSlider'

const APP_VERSION = '0.1.0'

export function SystemPanel() {
  const resetAll = useSettingsStore((state) => state.resetAll)
  const theme = useSettingsStore((state) => state.theme)
  const darkMode = useSettingsStore((state) => state.darkMode)
  const setTheme = useSettingsStore((state) => state.setTheme)
  const setDarkMode = useSettingsStore((state) => state.setDarkMode)
  const recordingEnabled = useSettingsStore((state) => state.recordingEnabled)
  const recordingDir = useSettingsStore((state) => state.recordingDir)
  const prerollSeconds = useSettingsStore((state) => state.prerollSeconds)
  const postrollSeconds = useSettingsStore((state) => state.postrollSeconds)
  const setRecordingEnabled = useSettingsStore((state) => state.setRecordingEnabled)
  const setRecordingDir = useSettingsStore((state) => state.setRecordingDir)
  const setPrerollSeconds = useSettingsStore((state) => state.setPrerollSeconds)
  const setPostrollSeconds = useSettingsStore((state) => state.setPostrollSeconds)
  const [confirming, setConfirming] = useState(false)
  const [defaultDir, setDefaultDir] = useState('')
  const [picking, setPicking] = useState(false)

  useEffect(() => {
    if (!isTauri()) return
    void (async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const dir = await invoke<string>('evidence_default_dir').catch(() => '')
      setDefaultDir(dir)
    })()
  }, [])

  const pickDirectory = async () => {
    if (picking || !isTauri()) return
    setPicking(true)
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const picked = await open({
        directory: true,
        multiple: false,
        title: '选择证据录音保存位置',
      })
      if (typeof picked === 'string' && picked.trim()) setRecordingDir(picked)
    } finally {
      setPicking(false)
    }
  }

  return (
    <div className="space-y-3">
      <SectionCard title="外观" hint="选择浅色主题，或切换暗黑模式">
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

      <SectionCard title="证据与录制" hint="命中警报时，把事件前后的一小段音频存成本地文件">
        <Row label="自动录制证据" hint="平时音频只在内存里循环缓冲，不写磁盘">
          <Toggle checked={recordingEnabled} label="自动录制证据" onChange={setRecordingEnabled} />
        </Row>

        <div className={`mt-2.5 ${recordingEnabled ? '' : 'opacity-45'}`}>
          <div className="mb-1 text-[10.5px] text-ink-soft">保存位置</div>
          <div className="flex items-center gap-1.5">
            <span
              className="min-w-0 flex-1 truncate rounded-lg border border-line bg-paper-2 px-2.5 py-1.5 text-[10.5px] text-ink-soft"
              title={recordingDir || defaultDir}
            >
              {recordingDir || defaultDir || '默认目录（应用数据 / recordings）'}
            </span>
            <button
              type="button"
              onClick={() => void pickDirectory()}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-line bg-surface px-2 py-1.5 text-[10.5px] font-medium text-ink-soft transition-colors hover:text-ink"
            >
              <FolderOpen size={11} strokeWidth={2} />
              选择
            </button>
            {recordingDir ? (
              <button
                type="button"
                onClick={() => setRecordingDir('')}
                className="shrink-0 rounded-lg border border-line bg-surface px-2 py-1.5 text-[10.5px] font-medium text-ink-soft transition-colors hover:text-ink"
              >
                默认
              </button>
            ) : null}
          </div>

          <div className="mt-2.5 space-y-2.5">
            <ValueSlider
              label="事件前缓冲"
              value={prerollSeconds}
              min={PREROLL_MIN}
              max={PREROLL_MAX}
              step={1}
              unit="秒"
              disabled={!recordingEnabled}
              onChange={setPrerollSeconds}
              hint="内存里一直保留最近这么久的音频，不会错过事件开头"
            />
            <ValueSlider
              label="事件后录制"
              value={postrollSeconds}
              min={POSTROLL_MIN}
              max={POSTROLL_MAX}
              step={1}
              unit="秒"
              disabled={!recordingEnabled}
              onChange={setPostrollSeconds}
              hint="触发后继续录这么久，和前面的缓冲一起存成一个文件"
            />
          </div>

          <p className="mt-2 text-[10px] leading-relaxed text-ink-faint">
            只有警报触发时才写盘：前 {prerollSeconds} 秒 + 后 {postrollSeconds} 秒，单声道 16 kHz
            WAV，仅保存在本机。每条保存记录都会写进日志。
          </p>
        </div>
      </SectionCard>

      <SectionCard title="关于">
        <Row label="dBound" hint={`版本 ${APP_VERSION} · Windows 10 1809+ / 11`} />
        <Row label="读数说明" hint="本应用用麦克风响度估测分贝，数值用于比较相对大小，不能用于声学计量或法律用途。" />
        <Row
          label="隐私"
          hint="音频只在本机处理；平时仅在内存中计算并循环缓冲，只有警报触发且开启证据录制时才写入本地文件，从不上传。"
        />
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
                : 'border-line bg-surface text-ink-soft hover:text-ink'
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
