import { Row, SectionCard } from '../ui/SectionCard'

const APP_VERSION = '1.0.1 Beta2'

export function AboutPanel() {
  return (
    <div className="space-y-3">
      <SectionCard title="关于" hint="版本、授权与作者信息">
        <Row label="dBound" hint="桌面音量哨兵 · 课堂 / 自习响度提示" />
        <Row label="版本" hint={APP_VERSION} />
        <Row label="授权" hint="安装时校验序列号；复制安装目录到其他电脑需重新激活。" />
        <Row
          label="读数说明"
          hint="本应用用麦克风响度估测分贝，数值用于比较相对大小，不能用于声学计量或法律用途。"
        />
        <Row
          label="隐私"
          hint="音频只在本机处理；平时仅在内存中计算并循环缓冲，只有警报触发且开启证据录制时才写入本地文件，从不上传。"
        />
        <Row label="数据存储" hint="设置保存在本机 WebView 的 localStorage，卸载应用时一并清除。" />
      </SectionCard>

      <div className="px-1 pt-1 text-center text-[10.5px] leading-relaxed text-ink-faint">
        设计 / 创意 / 开发 | 作者：Source X
        <br />
        dBound · 桌面音量哨兵
        <br />
        估测值仅供感知参考
      </div>
    </div>
  )
}
