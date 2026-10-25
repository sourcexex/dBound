import { useCallback, useEffect, useState } from 'react'
import { Camera, Mic, RefreshCw } from 'lucide-react'
import { listAudioInputs, onDeviceChange, type AudioInput } from '../../lib/audio/capture'
import { listCameras, type CameraDevice } from '../../lib/camera'
import { useLevelStore } from '../../stores/level'
import { useSettingsStore } from '../../stores/settings'
import { Row, SectionCard } from '../ui/SectionCard'

export function DevicesPanel({ onRestart }: { onRestart: (deviceId: string) => void }) {
  const deviceId = useSettingsStore((state) => state.deviceId)
  const setDeviceId = useSettingsStore((state) => state.setDeviceId)
  const deviceLabel = useLevelStore((state) => state.deviceLabel)
  const cameraId = useSettingsStore((state) => state.cameraId)
  const snapshotEnabled = useSettingsStore((state) => state.snapshotEnabled)
  const setCameraId = useSettingsStore((state) => state.setCameraId)
  const constraintFallback = useLevelStore((state) => state.constraintFallback)
  const status = useLevelStore((state) => state.status)

  const [devices, setDevices] = useState<AudioInput[]>([])
  const [cameras, setCameras] = useState<CameraDevice[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      let list = await listAudioInputs()
      if (list.length === 0) {
        // WebView2 can report an empty list on the very first call after the
        // permission is granted; retry once shortly after.
        await new Promise((resolve) => window.setTimeout(resolve, 400))
        list = await listAudioInputs()
      }
      setDevices(list)
      setCameras(await listCameras().catch(() => []))
    } catch {
      setDevices([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    return onDeviceChange(() => {
      void refresh()
    })
  }, [refresh])

  const options: Array<{ deviceId: string; label: string }> = [
    { deviceId: 'default', label: '跟随系统默认' },
    ...devices.filter((device) => device.deviceId !== 'default'),
  ]

  const select = (id: string) => {
    setDeviceId(id)
    onRestart(id)
  }

  return (
    <div className="space-y-3">
      <SectionCard
        title="输入设备"
        hint={status === 'running' ? `当前：${deviceLabel || '默认麦克风'}` : '测量未运行时切换会在下次启动生效'}
        action={
          <button
            type="button"
            onClick={() => void refresh()}
            aria-label="刷新设备"
            className="grid h-6 w-6 place-items-center rounded-md text-ink-faint transition-colors hover:bg-ink/[0.05] hover:text-ink"
          >
            <RefreshCw size={12.5} strokeWidth={2} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      >
        <div className="space-y-1.5">
          {options.map((option) => {
            const selected = deviceId === option.deviceId
            return (
              <button
                key={option.deviceId}
                type="button"
                onClick={() => select(option.deviceId)}
                className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                  selected ? 'border-ink/25 bg-surface' : 'border-transparent hover:bg-ink/[0.03]'
                }`}
              >
                <Mic size={13} strokeWidth={2} className="shrink-0 text-ink-soft" />
                <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink">{option.label}</span>
                <span
                  className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border ${
                    selected ? 'border-ink bg-ink' : 'border-[#C9C8C1]'
                  }`}
                >
                  {selected ? <span className="h-1 w-1 rounded-full bg-paper" /> : null}
                </span>
              </button>
            )
          })}
        </div>
        {devices.length === 0 ? (
          <p className="mt-2 text-[10.5px] text-ink-faint">
            还没有读到设备列表。首次授权后设备名称才会显示，可点右上角刷新。
          </p>
        ) : null}
      </SectionCard>

      <SectionCard
        title="摄像头（现场快照）"
        hint={snapshotEnabled ? '用于触发警报时拍照' : '快照未开启，选择会在开启后生效'}
        action={
          <button
            type="button"
            onClick={() => void refresh()}
            aria-label="刷新摄像头"
            className="grid h-6 w-6 place-items-center rounded-md text-ink-faint transition-colors hover:bg-ink/[0.05] hover:text-ink"
          >
            <RefreshCw size={12.5} strokeWidth={2} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      >
        <div className="space-y-1.5">
          {[{ deviceId: 'default', label: '跟随系统默认' }, ...cameras].map((camera) => {
            const selected = cameraId === camera.deviceId
            return (
              <button
                key={camera.deviceId}
                type="button"
                onClick={() => setCameraId(camera.deviceId)}
                className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                  selected ? 'border-ink/25 bg-surface' : 'border-transparent hover:bg-ink/[0.03]'
                }`}
              >
                <Camera size={13} strokeWidth={2} className="shrink-0 text-ink-soft" />
                <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink">{camera.label}</span>
                <span
                  className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border ${
                    selected ? 'border-ink bg-ink' : 'border-[#C9C8C1]'
                  }`}
                >
                  {selected ? <span className="h-1 w-1 rounded-full bg-paper" /> : null}
                </span>
              </button>
            )
          })}
        </div>
        {cameras.length === 0 ? (
          <p className="mt-2 text-[10.5px] leading-relaxed text-ink-faint">
            还没有读到摄像头。首次开启快照（或点刷新）后系统才会返回设备列表。
          </p>
        ) : null}
      </SectionCard>

      {constraintFallback ? (
        <SectionCard title="兼容性提示">
          <Row
            label="已放宽采集约束"
            hint="当前麦克风不接受「关闭回声消除/降噪/自动增益」的要求，读数可能波动更大，但不影响相对比较。"
          />
        </SectionCard>
      ) : (
        <SectionCard title="采集设置">
          <Row label="回声消除 / 降噪 / 自动增益" hint="已强制关闭，否则读数会被系统「熨平」" />
        </SectionCard>
      )}
    </div>
  )
}
