import { useEffect, useState } from 'react'
import { FolderOpen, RotateCcw } from 'lucide-react'
import {
  POSTROLL_MAX,
  POSTROLL_MIN,
  PREROLL_MAX,
  PREROLL_MIN,
} from '../../lib/settingsSchema'
import { CameraMonitor } from '../../lib/camera'
import { evidenceStamp, saveEvidenceBytes } from '../../lib/evidence'
import { logSystem } from '../../lib/logger'
import { SNAPSHOT_SIZES, type SnapshotSize } from '../../lib/settingsSchema'
import { isTauri } from '../../lib/tauri'
import { THEME_OPTIONS } from '../../lib/theme'
import { useSettingsStore } from '../../stores/settings'
import { Toggle } from '../ui/Toggle'
import { Row, SectionCard } from '../ui/SectionCard'
import { ValueSlider } from '../ui/ValueSlider'
import { useLevelStore } from '../../stores/level'

const INPUT_CLASS =
  'w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[11px] text-ink outline-none transition-colors focus:border-ink/30'

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
  const modeLabels = useSettingsStore((state) => state.modeLabels)
  const evidenceModes = useSettingsStore((state) => state.evidenceModes)
  const setEvidenceMode = useSettingsStore((state) => state.setEvidenceMode)
  const snapshotEnabled = useSettingsStore((state) => state.snapshotEnabled)
  const cameraId = useSettingsStore((state) => state.cameraId)
  const snapshotSize = useSettingsStore((state) => state.snapshotSize)
  const setSnapshotEnabled = useSettingsStore((state) => state.setSnapshotEnabled)
  const setSnapshotSize = useSettingsStore((state) => state.setSnapshotSize)
  const [testing, setTesting] = useState(false)
  const [cameraError, setCameraError] = useState('')
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

  const testPhoto = async () => {
    if (testing) return
    setTesting(true)
    setCameraError('')
    const camera = new CameraMonitor()
    try {
      await camera.start({ deviceId: cameraId, size: snapshotSize })
      const bytes = await camera.capture()
      const path = await saveEvidenceBytes(
        recordingDir,
        `测试照片-${evidenceStamp()}.jpg`,
        bytes,
      )
      logSystem(`已保存测试照片（${Math.round(bytes.length / 1024)} KB）：${path}`)
      useLevelStore.getState().setToast(`已保存测试照片 · ${Math.round(bytes.length / 1024)} KB`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setCameraError(`摄像头不可用：${message}`)
    } finally {
      camera.stop()
      setTesting(false)
    }
  }

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

        <div className="mt-2 rounded-xl border border-line bg-surface/50 p-2.5">
          <div className="mb-1.5 text-[10.5px] font-medium text-ink-soft">按模式启用（录音 + 照片）</div>
          <div className="grid grid-cols-2 gap-2">
            {(['forward', 'reverse'] as const).map((key) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-lg border border-line bg-surface px-2 py-1.5"
              >
                <span className="min-w-0 truncate text-[11px] font-medium text-ink">
                  {modeLabels[key]}
                </span>
                <Toggle
                  checked={evidenceModes[key]}
                  label={`${modeLabels[key]} 证据录制`}
                  onChange={(enabled) => setEvidenceMode(key, enabled)}
                />
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[9.5px] leading-relaxed text-ink-faint">
            关掉某个模式后，该模式触发警报时不保存录音和照片；另一个模式不受影响。
          </p>
        </div>

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

          <div className="mt-3.5 border-t border-line/70 pt-3">
            <Row label="现场快照" hint="触发瞬间用摄像头拍一张 JPG，与录音放在同一目录">
              <Toggle checked={snapshotEnabled} label="现场快照" onChange={setSnapshotEnabled} />
            </Row>

            <div className={`mt-2 ${snapshotEnabled ? '' : 'opacity-45'}`}>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-[10.5px] text-ink-soft">分辨率</span>
                  <select
                    className={INPUT_CLASS}
                    value={snapshotSize}
                    disabled={!snapshotEnabled}
                    onChange={(event) => setSnapshotSize(event.target.value as SnapshotSize)}
                  >
                    {Object.entries(SNAPSHOT_SIZES).map(([key, size]) => (
                      <option key={key} value={key}>
                        {size.width} × {size.height}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-end pb-1">
                  <p className="text-[9.5px] leading-relaxed text-ink-faint">
                    摄像头在「设备」页选择
                  </p>
                </div>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  disabled={!snapshotEnabled || testing}
                  onClick={() => void testPhoto()}
                  className="shrink-0 rounded-lg border border-line bg-surface px-2 py-1.5 text-[10.5px] font-medium text-ink-soft transition-colors hover:text-ink disabled:opacity-50"
                >
                  {testing ? '拍照中…' : '测试拍照'}
                </button>
                <span className="text-[9.5px] leading-relaxed text-ink-faint">
                  测试照片也会保存到上面的目录；实际分辨率以摄像头能力为准
                </span>
              </div>
              {cameraError ? (
                <p className="mt-1.5 text-[10px] text-[#DC2626]">{cameraError}</p>
              ) : null}

              <p className="mt-2 text-[10px] leading-relaxed text-ink-faint">
                摄像头只在「测量中 + 快照开启」时工作，其余时间完全关闭；没有常驻预览、不上传。
                照片只在警报触发时保存，名单与录音一致。
              </p>
            </div>
          </div>
        </div>
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
