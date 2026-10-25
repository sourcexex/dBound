import { DEFAULT_CAMERA_ID, SNAPSHOT_SIZES, type SnapshotSize } from './settingsSchema'

export interface CameraDevice {
  deviceId: string
  label: string
}

/** Video inputs; labels only appear after camera permission was granted once. */
export async function listCameras(): Promise<CameraDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return []
  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices
    .filter((device) => device.kind === 'videoinput')
    .map((device, index) => ({
      deviceId: device.deviceId || DEFAULT_CAMERA_ID,
      label: device.label || `摄像头 ${index + 1}`,
    }))
}

function waitForFrame(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 2 && video.videoWidth > 0) return Promise.resolve()
  return new Promise((resolve) => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      video.removeEventListener('loadeddata', done)
      resolve()
    }
    video.addEventListener('loadeddata', done, { once: true })
    window.setTimeout(done, 4000)
  })
}

/**
 * Keeps the newest camera frame in an offscreen canvas while measuring, so an
 * alert can save the exact trigger moment instead of a frame seconds later.
 * Nothing is displayed and nothing is recorded unless a snapshot is taken.
 */
export class CameraMonitor {
  private stream: MediaStream | null = null
  private video: HTMLVideoElement | null = null
  private canvas: HTMLCanvasElement | null = null
  private timer: number | null = null
  private starting: Promise<void> | null = null

  get isRunning(): boolean {
    return this.stream !== null
  }

  start(options: { deviceId: string; size: SnapshotSize }): Promise<void> {
    if (this.stream) return Promise.resolve()
    if (this.starting) return this.starting
    this.starting = this.open(options).finally(() => {
      this.starting = null
    })
    return this.starting
  }

  private async open(options: { deviceId: string; size: SnapshotSize }): Promise<void> {
    const dimensions = SNAPSHOT_SIZES[options.size]
    const video: MediaTrackConstraints = {
      width: { ideal: dimensions.width },
      height: { ideal: dimensions.height },
    }
    if (options.deviceId && options.deviceId !== DEFAULT_CAMERA_ID) {
      video.deviceId = { exact: options.deviceId }
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video })
    const element = document.createElement('video')
    element.muted = true
    element.playsInline = true
    element.autoplay = true
    element.style.cssText =
      'position:fixed;left:-9999px;top:-9999px;width:2px;height:2px;opacity:0;pointer-events:none'
    document.body.appendChild(element)
    element.srcObject = stream
    await element.play().catch(() => undefined)
    await waitForFrame(element)

    const canvas = document.createElement('canvas')
    canvas.width = element.videoWidth || dimensions.width
    canvas.height = element.videoHeight || dimensions.height

    this.stream = stream
    this.video = element
    this.canvas = canvas
    this.draw()
    this.timer = window.setInterval(() => this.draw(), 150)
  }

  private draw(): void {
    const video = this.video
    const canvas = this.canvas
    if (!video || !canvas || video.readyState < 2) return
    try {
      canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
    } catch {
      // the camera may still be warming up
    }
  }

  /** JPEG bytes of the newest buffered frame. */
  async capture(): Promise<Uint8Array> {
    if (!this.canvas || !this.stream) throw new Error('摄像头未开启')
    this.draw()
    const blob = await new Promise<Blob | null>((resolve) => {
      this.canvas?.toBlob(resolve, 'image/jpeg', 0.92)
    })
    if (!blob) throw new Error('拍照失败')
    return new Uint8Array(await blob.arrayBuffer())
  }

  stop(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer)
      this.timer = null
    }
    this.stream?.getTracks().forEach((track) => track.stop())
    if (this.video) {
      this.video.srcObject = null
      this.video.remove()
    }
    this.stream = null
    this.video = null
    this.canvas = null
  }
}
