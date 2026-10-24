# dBound · 需求规格 v0.3（采集改 JS 原生 + 日志中心，待最终确认）

> Windows 桌面噪声/音量监控小工具。用麦克风测环境响度并估测分贝，按自定义多级阈值在「太吵」或「太小声」时用界面变色和文字提醒。
> 本文是开发依据；确认后不再改动，变更走记录。

---

## 0. 决策记录

| 项 | 决定 | 说明 |
| --- | --- | --- |
| 采集路线 | **前端 JS 原生（Web Audio API）** | 参考 [47096/noise-monitor](https://github.com/47096/noise-monitor) 的采集参数与结构；Rust 只负责窗口、托盘、设置与日志 IO |
| 显示值 | **估测 dB**（`20·log10(rms) + offset`） | 参考仓库只给 0–100 相对值；我们按你的要求换算成 dB，但仍标注「≈ 估测」 |
| 提醒通道 | **仅视觉**：变色 + 提示文字 + 迷你窗边缘呼吸/柔光 | 无提示音、无系统通知、无托盘变色；代码留 `AlertChannel` 扩展点 |
| 级别数量 | **1–8 级，默认 3 级预设** | 可增删、可拖拽排序，保存时校验阈值顺序 |
| 反向模式场景 | **朗读练习音量监测** | 「声音太小」提醒；默认 Slow + 朗读平滑 3 s + 朗读校准 |
| 日志 | **事件 + 每秒采样，应用内查看 + 可导出 CSV** | 主窗口独立「日志」页；按天滚动，保留 7 天 |
| 视觉风格 | **极简浅色** | 暖白底 + 近黑大字 + 克制的级别色 |
| 迷你窗 | **数字胶囊**（≈120×44） | 置顶、不进任务栏、可拖动、位置记忆；超阈值边缘呼吸 + 柔光 |
| 系统 | Win10 1809+ / Win11 x64，per-user 免管理员 | 关闭进托盘；开机自启默认关 |

## 1. 定位与设计原则

- **一句话**：dBound 是你的桌面音量哨兵——太吵、或者（朗读时）太小声，余光就能看见。
- **估测，不是计量**：数值本质是 dBFS + 偏移量，每支麦克风差异可达 10 dB 以上。界面用 `≈` 标注，不承诺声学精度。
- **打开即用**：默认设备 + 默认偏移 + 3 级预设；所有细节可调。
- **安静的工具**：默认零声音、零弹窗。暂停要真正释放麦克风（系统麦克风指示灯熄灭），让用户确认它没在偷听。
- **仅 Windows**：不背跨平台包袱。

## 2. 调研参考

| 参考 | 借鉴点 |
| --- | --- |
| [47096/noise-monitor](https://github.com/47096/noise-monitor)（本次指定参考，vanilla JS PWA） | 采集链路：`getUserMedia` 关闭 `echoCancellation / noiseSuppression / autoGainControl`（失败回退 `{audio:true}`）；`AnalyserNode` fftSize 2048 + smoothing 0.2；`getFloatTimeDomainData` 取 RMS，老引擎回退 `getByteTimeDomainData`；EMA 平滑 `v*0.72+next*0.28`；rAF + 100 ms 定时器双通道采样；停止时逐层 `disconnect()` + `track.stop()`。**它刻意只给 0–100 相对值，不做 dB 承诺**——我们保留其链路，但换算成估测 dB |
| [SoundLevelTest 作者经验](https://dev.to/nayeem_soundtest_6d2ce2a4/what-i-learned-building-a-decibel-meter-that-runs-entirely-in-the-browser-346l) | 同上「关掉三件套」的独立佐证；RMS 而非峰值；dBFS→dB 靠偏移；停止必须释放麦克风 |
| [SounDoer/PLVS](https://github.com/SounDoer/PLVS) | 桌面电平表的信息层级：大数字 + 峰值保持 + Fast/Slow 时间加权 |
| [Tauri 2 Webview Versions](https://v2.tauri.app/reference/webview-versions/) | WebView2 支持 Win7+ 可自更新，Win11 预装，老系统由安装包补装 |
| [Tauri 窗口自定义](https://v2.tauri.app/learn/window-customization/) | 无边框/透明/拖拽区域，用于迷你窗与自绘标题栏 |

## 3. 核心概念

- **估测电平** `level = 20·log10(rms) + offset`，显示为 `≈ 62.4 dB`。
- **平滑**：前端两级——帧级 EMA（沿用参考库的 0.72/0.28）→ 显示级时间加权（正向 Fast 125 ms / 反向 Slow 1 s / 朗读平滑 3 s）。
- **级别** `{threshold, name, note, color, enabled}`，最多 8 条。
- **正向模式**：`level ≥ threshold` 越界，阈值越高越严重（吵）。
- **反向模式**：`level ≤ threshold` 越界，阈值越低越严重（太小声）。
- **命中级别（active）**：当前越界且满足持续时长的那一级，决定数字/背景/胶囊的颜色与提示文字。

## 4. 功能需求

### FR-1 实时测量（JS 原生 Web Audio）
- 采集配置完全对齐参考仓库：`echoCancellation:false, noiseSuppression:false, autoGainControl:false`，失败回退 `{audio:true}` 并在日志里记一条 warn。
- `AudioContext` + `AnalyserNode(fftSize 2048, smoothingTimeConstant 0.2)`；`source → analyser`；为兼容部分引擎再做 `analyser → zeroGain → destination` 的静音串联（参考仓库为 iOS 加的，WebView2 上留着无害）。
- `getFloatTimeDomainData` 取帧 → 平方和 → RMS；异常时回退 `getByteTimeDomainData`（`(v-128)/128`）。
- **采样驱动**：`requestAnimationFrame` + 100 ms `setInterval` 双通道（rAF 在窗口隐藏/节流时靠定时器兜底）；`document.visibilityState === 'hidden'` 时暂停定时器采样。
- 换算：`dbfs = 20·log10(max(rms, 1e-8))`，`level = dbfs + offset`，裁剪到 `0–120 dB` 后送 UI。
- 推送 UI 限流 30 Hz（值变化 ≤ 0.1 dB 时合并）。
- 暂停 = 逐层 `disconnect()`、`track.stop()`、`audioContext.close()`，麦克风指示灯必须熄灭；恢复时重建整条链路。
- 设备：`enumerateDevices` 列 `audioinput`，`deviceId` 切换；`devicechange` 监听热插拔，掉线自动回落默认设备并提示。

### FR-2 正向模式（太吵报警）
默认预设（环境噪声，可改）：

| 级别 | 阈值 | 提示文字 | 颜色 |
| --- | --- | --- | --- |
| 注意 | 65 dB | 有点吵了 | 蓝 `#2563EB` |
| 警告 | 75 dB | 声音偏大，注意一下 | 琥珀 `#D97706` |
| 危险 | 85 dB | 太吵了 | 红 `#DC2626` |

越界持续 `dwell`（默认 2 s）触发；回落超过 `hysteresis`（默认 3 dB）并持续 1 s 解除。

### FR-3 反向模式（朗读太小声报警）
默认预设（朗读/配音练习，可改）：

| 级别 | 阈值 | 提示文字 | 颜色 |
| --- | --- | --- | --- |
| 偏小 | 60 dB | 声音偏小，再大声一点 | 蓝 `#2563EB` |
| 过小 | 50 dB | 几乎听不到你的声音 | 琥珀 `#D97706` |
| 无声 | 40 dB | 没有检测到声音 | 红 `#DC2626` |

默认 Slow（1 s）+「朗读平滑 3 s」（默认开），让读数跟着句子走而不是跟着音节跳。默认阈值在 P1 用真实麦克风实测微调。

### FR-4 级别编辑器
- 增删（1–8 级）、拖拽排序；保存时按当前模式校验收/降序，冲突内联提示。
- 字段：阈值（0–120，步长 0.5）、名称（≤8 字）、提示文字（≤30 字）、颜色（预设 10 色 + 取色器）、启用开关。
- **实时预览**：用最近 10 s 实测数据回放，拖阈值时直接演示「这级什么时候亮」。
- 「恢复默认预设」（正/反向两套）。

### FR-5 报警呈现（仅视觉）
- 数字、单位、顶部状态标签、主背景淡色晕染同步换色，过渡 150 ms。
- 命中级别时出现提示文字条（级别名 · 提示文字）。
- **迷你窗边缘呼吸**：命中级别时胶囊边框在 2 s 周期内透明度 0.55→1 缓慢呼吸（`prefers-reduced-motion` 下改为静态描边）。
- 级别升级（如「注意」→「警告」）时边框柔光扩散一次（300 ms），不闪烁。
- 扩展点：`AlertChannel` 事件，后续可接提示音/通知/托盘变色。

### FR-6 迷你悬浮窗
- 数字胶囊 ≈120×44：`≈ 62 dB ●`，无边框圆角、置顶、不进任务栏、可拖动、位置记忆、多显示器安全（越界时回落到主屏右下）。
- 单击 → 显示主窗口；右键 → 菜单（回主页 / 暂停 / 退出）；双击 → 暂停（可改）。
- 主窗口关闭 → 进托盘；托盘菜单：显示主窗口 / 迷你窗 / 暂停 / 退出。
- 透明度可选（80–100%），默认不透明。

### FR-7 校准
- 偏移量滑杆 −30…+30 dB（步长 0.5），主界面实时跟随。
- 「安静环境一键校准」：采 3 s 底噪，对齐到目标 35 dB。
- 「朗读校准」：提示正常朗读一句，取 3 s 平均值对齐到 70 dB。
- 固定说明：不同麦克风差 10 dB 很正常，追求准确请用专业声级计。

### FR-8 设置与持久化
- 全部设置 JSON 落盘，重启恢复；「恢复默认」。
- 设备下拉 +「跟随系统默认」；设备掉线自动回落并提示。
- 配置带 `schemaVersion`，升级时做迁移。

### FR-9 系统集成
- 托盘常驻（图标 = 当前状态）、单实例、开机自启（默认关）、全局快捷键呼出/隐藏（默认关）。

### FR-10 日志中心（应用内查看 + 导出）
- **入口**：主窗口标题栏「日志」图标 → 独立整页（不是抽屉），可从主界面一键返回；命中级别时该图标显示一个小圆点提示「有新事件」。
- **记录内容**
  - 事件（JSONL，一条一行）：`级别触发 / 级别解除`（附级别名、当时 dB）、`模式切换`、`校准`（类型、前后 offset）、`设备切换/断开`、`暂停/恢复`、`错误`（采集失败、权限拒绝、Web Audio 异常）、`应用启动/退出版本号`。
  - 采样：每 1 s 一条 `{ts, db, activeLevel?}`，用于回看整段曲线；仅在测量中写入，暂停即停。
- **日志页 UI**：按天分组的时间流水，倒序；顶部筛选（全部 / 触发 / 设备 / 系统 / 采样）、日期选择、关键词搜索；每条含时间、类型色点、文本；采样可用迷你折线预览当天走势。
- **存储**：`%APPDATA%\com.dbound.app\logs\YYYY-MM-DD.jsonl`（Rust 侧写入，自动按天切分）；保留 7 天，总量上限 20 MB，超限从最旧删；设置里可「立即清空日志」。
- **导出**：右上「导出」→ 保存对话框 → 导出 CSV（列：`时间, 类型, 级别, dB, 文本`）；可选「导出本周全部」。
- **隐私**：日志只含分贝数值与事件文本，绝不含音频；日志页底部写明这一点。
- **性能**：日志写入在 Rust 侧独立线程/异步，不阻塞采样；1 s 一条的量级可忽略。

### 非目标
录音、频谱分析、多设备同时监听、云同步、移动端、macOS/Linux、自动更新服务端。

## 5. 界面

**主窗口 420×620，自绘标题栏（圆角、可拖拽、无系统边框）**

```
┌────────────────────────────────┐
│ dBound        [正向|反向]  ⧉ ⚙ ▢│   ← ⧉ 日志（有新事件带小圆点）
│                                │
│            ≈ 62.4              │   ← 120 px，字重 600，随级别着色
│               dB               │
│        ─ 偏小 · 再大声一点 ─     │   ← 命中级别标签；无命中显示「安静」
│                                │
│   ▁▂▃▅▆▇▆▅▃▂▁ 最近 60 秒       │   ← Canvas 柱状/折线 + 阈值虚线
│                                │
│  [⏸]   默认麦克风 · 30 fps   [⎘] │   ← 暂停 / 设备状态 / 迷你窗
└────────────────────────────────┘
```

- 配色：底 `#FAFAF8`、卡片 `#FFFFFF`、主文字 `#17171A`、次级 `#6B6B72`、分隔线 `#ECECE8`；级别色只出现在数字、标签、波形、背景晕染与胶囊边框上。
- 字体：数字用等宽可变字体（`Inter` 数字特性或 `JetBrains Mono`）避免跳宽；中文用 `Microsoft YaHei UI`。
- 设置抽屉 360 px，分「模式 / 级别 / 校准 / 设备 / 系统」五段；日志为独立页。

## 6. 报警引擎

```
每帧：
  db    = smooth(rawDbfs + offset)          // 帧 EMA + 时间加权
  hit   = forward ? { L | db >= L.th } : { L | db <= L.th }
  cand  = hit 中最严重一级（forward 最大阈值 / reverse 最小阈值）
  if cand == active：维持
  else if cand 持续 >= dwell(2000ms)：active = cand，记日志 + 触发视觉
  if active 不再满足：回退侧超过 hysteresis(3dB) 且持续 exitDwell(1000ms) → active = null，记日志
```

参数默认：`dwell 2000 ms`、`hysteresis 3 dB`、`exitDwell 1000 ms`。引擎为纯函数：给定 dB 序列 → 断言 active 变化序列与日志事件，配单测。

## 7. 技术方案

- **外壳**：Tauri 2（cli 2.11.4）+ Rust 1.97；`withGlobalTauri:false`，严格 capability。
- **前端**：React 19 + TS + Vite + Tailwind CSS v4 + lucide-react；波形用 Canvas，不引图表库；无重型动画库。
- **音频（前端模块 `src/lib/audio/`）**
  - `capture.ts`：`getUserMedia` 约束与回退、`AnalyserNode` 建链/拆链、`getFloatTimeDomainData` 与 byte 回退、rAF + 100 ms 定时器双驱动、`devicechange` 处理。
  - `dsp.ts`：RMS→dBFS→offset→dB、EMA、时间加权、峰值保持。
  - `useLevelMonitor.ts`：React hook，向 store 推 30 Hz 节流值。
- **Rust 侧（很少）**：窗口创建/迷你窗、托盘、单实例、自启、全局快捷键、日志写入与导出、`open mic settings` 深链。
- **状态与持久化**：zustand + `tauri-plugin-store`（设置）+ Rust 日志模块（JSONL 按天切分）。
- **窗口**：主窗口 + `mini.html` 独立 Vite 入口；mini 由 Rust 创建/隐藏（`always_on_top`、`decorations:false`、`skip_taskbar:true`）。
- **插件**：`single-instance`、`autostart`、`window-state`、`store`、`dialog`（导出保存框）。
- **打包**：NSIS per-user（`installMode: CurrentUser`）+ `webviewInstallMode: downloadBootstrapper`；另出 portable 目录自测。
- **目录**：`src/{pages,components,stores,lib}`、`src-tauri/src/{audio?,windows,logs,settings}`（`audio` 仅保留日志与错误码，不做采集）、`docs/`。

## 8. 非功能指标

- 兼容：Win10 1809+ / Win11 x64；普通权限；高 DPI 正确缩放；无 WebView2 时安装包自动补装；麦克风隐私关闭时给出引导 + 打开 `ms-settings:privacy-microphone`。
- 性能：仅迷你窗时 CPU < 1%；主窗口可见 < 2%；内存 < 150 MB；冷启动 < 1.5 s。
- 稳定：24 h 连续运行无内存增长；窗口隐藏/恢复、睡眠唤醒、设备拔插后自动恢复采样。
- 可测：`dsp.ts` 与报警引擎纯函数单测（Vitest）；日志写入/切分/清理 Rust 单测；P6 干净环境安装验证。

## 9. 里程碑

| 阶段 | 内容 | 验收 |
| --- | --- | --- |
| **S** | **技术验证 Spike（先做，约 30 分钟）**：最小 Tauri 窗口里跑通 `getUserMedia` + AnalyserNode，确认 WebView2 麦克风授权 | 能看到实时 RMS；若被拒，验证 `additionalBrowserArgs` 兜底方案 |
| P0 | 脚手架、采集链路、30 Hz 推送、中央大数字、暂停/设备状态 | 运行即见实时读数；暂停后麦克风灯灭；拔插设备不崩 |
| P1 | 报警引擎、正/反模式、级别着色与提示文字、60 s 波形、呼吸动效 | 真实麦克风实测各级触发/回落正确、不抖 |
| P2 | 设置抽屉、级别编辑器 + 实时预览、两种校准、持久化 | 重启后配置完整恢复 |
| P3 | 迷你胶囊窗、托盘、单实例、自启/快捷键 | 胶囊置顶可拖、位置记忆、主窗关闭进托盘 |
| P4 | 日志中心：写入、按天切分、清理、列表/筛选/搜索、CSV 导出 | 触发一次能同时在主页与日志页看到；导出文件可打开 |
| P5 | 图标、打包、README、24 h 自测、浅色主题终检 | 安装包在干净环境可装可跑 |

## 10. 风险与对策

| 风险 | 对策 |
| --- | --- |
| **WebView2 里 `getUserMedia` 被拒（最大风险）** | S 阶段先验证；失败则依次尝试：`additionalBrowserArgs` 授权参数 → 引导用户在 Windows 隐私设置里放行 → 兜底改回 Rust 采集（本 PRD 的 DSP 与 UI 层不受影响，只换数据源） |
| `AudioContext` 在页面隐藏时被挂起 | 参考仓库已给方案：`onstatechange` 自动 `resume()`，并保留 100 ms 定时器兜底 |
| 麦克风隐私开关关闭 / 驱动禁用 | 启动探测，明确文案 + 一键打开设置页；绝不显示假数据 |
| 朗读电平起伏大导致闪红 | 反向默认 Slow + 3 s 朗读平滑 + dwell 2 s；实测后再调默认阈值 |
| 不同麦克风偏移差异大 | 两种校准 + 手动偏移 + 「≈ 估测」文案 |
| 掉电/崩溃导致日志半行 | JSONL 逐行追加、单行 ≤ 2 KB；读取时跳过坏行 |
| 8 级阈值冲突 | 保存校验 + 内联提示 + 自动排序 |

## 11. 待你确认

- 本文件（v0.3）整体是否可以作为开发依据。
- 确认后我先做 **S 阶段技术验证**（约 30 分钟，只验证 WebView2 能不能拿到麦克风），通过后立刻进 P0。

---

## 附录 A. v0.4 增补：全屏模式（P5 之后追加）

**需求**：提供一个占满屏幕的展示模式，适合演讲、课堂、朗读打卡等投屏场景。

- 独立全屏窗口（`full.html`），不是主窗口最大化，避免影响主窗口布局与迷你窗
- 内容：整屏超大估测读数（`min(34vh, 26vw)`）、级别色晕染、状态行（级别 · 模式 · 偏大/偏小）、
  底部峰值与「估测值」提示
- 进入：主窗口标题栏 ⛶ 按钮 / **F11**；退出：**ESC** / 右上 ✕
- 鼠标静止 3.2 秒淡出顶部与底部信息栏，移动即恢复
- 与迷你窗共用同一条 10 Hz 事件流；进入全屏时收起主窗与迷你窗，退出时恢复主窗
- 验收：全屏窗口铺满显示器、读数持续刷新、ESC 与 F11 双向可用、全屏时无其他窗口干扰

**同时修复**：

- `window-state` 不再恢复窗口可见性（否则上次可见的迷你胶囊会在下次启动时出现）
- 持久化设置增加版本与结构校验（旧版/未知 schema 回落默认值，当前版本做字段清洗）
