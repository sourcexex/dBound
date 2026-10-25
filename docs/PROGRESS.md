# dBound 开发进度

> 规格见 [PRD.md](PRD.md)（v0.3）。本文件记录每个里程碑的完成情况与验证证据。

## 当前状态：P0–P6 全部完成 ✅

| 里程碑 | 状态 | 说明 |
| --- | --- | --- |
| S 技术验证 | ✅ | WebView2 里 `getUserMedia` 实测可用 |
| P0 采集 + 主界面 | ✅ | 实时读数、波形、暂停、错误态 |
| P1 报警引擎 | ✅ | dwell / hysteresis / exitDwell 三层防抖 + 切换动效 |
| P2 设置与校准 | ✅ | 五段设置页、级别编辑器、两种校准、设备切换 |
| P3 迷你胶囊 + 托盘 | ✅ | 置顶胶囊、跨窗口推流、托盘常驻、关闭到托盘 |
| P4 日志中心 | ✅ | 事件 + 每秒采样、JSONL、应用内查看、CSV 导出 |
| P5 打包与终检 | ✅ | release 构建、NSIS 安装包、README、稳定性自测 |
| P6 全屏模式 | ✅ | 独立全屏窗口、巨大读数、F11 进入 / ESC 退出、自动隐藏信息栏 |

**交付物**：`src-tauri/target/release/bundle/nsis/dBound_0.1.0_x64-setup.exe`
（1.26 MiB，per-user 安装，免管理员；SHA256 `64BD2329…C707FD`）

## 各阶段完成内容

### P0 采集与主界面
- Tauri 2.12 + React 19 + TS + Tailwind v4，自绘无边框标题栏、透明圆角窗口
- Web Audio 采集链路：关闭回声消除/降噪/AGC（失败回退 `{audio:true}`）、AnalyserNode 2048、
  `getFloatTimeDomainData` + byte 回退、rAF + 100ms 定时器双驱动、逐层 `disconnect` + `track.stop`
- 信号处理：RMS → dBFS → `+offset` → 估测 dB；帧级 EMA(0.72/0.28) + 显示级时间加权
  （正向 125ms / 反向 1s / 朗读 3s）
- 30 Hz 读数、3 秒峰值、60 秒波形（Canvas + 各级阈值虚线）
- 暂停真正释放麦克风；权限拒绝/无设备/占用/不支持分类文案 + 重试

### P1 报警引擎
- `src/lib/alertEngine.ts`：入场 dwell 2s、回落滞回 3dB、退场 1s；级别升降级同样走 dwell
- 输出 `enter / exit` 事件（P4 日志直接消费）；级别被禁用/删除立即释放
- 命中时数字/光晕/波形/标题胶囊同步换色 + 呼吸扩散环

### P2 设置与校准
- 设置页五段：模式 / 级别 / 校准 / 设备 / 系统
- 级别编辑器：1–8 级、阈值滑杆、名称、提示文字、10 色板、启用开关、删除、恢复默认、越序校验
- 实时阈值刻度条：色带 + 当前读数游标 + 命中提示
- 校准：偏移滑杆（65–125）、安静环境校准（35 dB）、朗读校准（70 dB），公式 `offset + (target - avg)`
- 设备列表 + 切换（重建采集链路）、设备枚举首帧为空时自动重试
- 所有设置 localStorage 持久化，重启保留

### P3 迷你胶囊 + 托盘
- 迷你窗 158×58，无边框/透明/置顶/跳过任务栏/可拖动，独立 `mini.html` 入口
- 主窗隐藏时仍以 10 Hz 经 Tauri 事件推流给胶囊，胶囊显示读数 + 级别色 + 呼吸边框
- 点击胶囊回主窗；托盘菜单（显示主窗口 / 迷你窗 / 退出）；左键托盘恢复
- 主窗关闭 = 收进托盘；窗口位置记忆（`tauri-plugin-window-state`）

### P4 日志中心
- Rust `logs.rs`：按天写 `%APPDATA%\com.dbound.desktop\logs\YYYY-MM-DD.jsonl`
  - 事件（alert/device/system）+ 每秒采样（sample）
  - 保留 7 天、总量 20 MB，启动后首次写入时自动清理最旧文件
  - 命令：`log_append / log_days / log_read / log_clear / log_export / log_dir`
- 前端 `logger.ts`：4 秒或 25 条批量落盘，`pagehide`/隐藏时强制 flush，绝不阻塞测量
- 日志页：日期选择、四种筛选、关键词搜索、当日采样统计 + 迷你走势图、
  CSV 导出（原生保存对话框，UTF-8 BOM）、两步确认清空
- 标题栏日志入口带未读红点

### P5 打包与终检
- `identifier` 改为 `com.dbound.desktop`，消除 Tauri 的 `.app` 告警
- 首次启动麦克风授权：两个窗口统一追加 `--use-fake-ui-for-media-stream`，
  打包后新 profile 直接拿到麦克风，不再卡在浏览器授权气泡
- 启动超过 3.5 秒仍无数据时，界面提示「若系统弹出麦克风权限请求，请点允许」
- release + NSIS per-user 安装包（`installMode: currentUser`，WebView2 bootstrapper）
- README、docs/images 截图、脚本化验收

### P6 全屏模式（P5 之后追加）
- 新增独立全屏窗口 `full.html`：1280×800 配置 + `fullscreen: true`，透明关闭、跳过任务栏
- 全屏页面：整屏超大读数（`min(34vh, 26vw)`）、级别色晕染、状态行、峰值与估测提示
- 三个窗口共用同一条 10 Hz Tauri 事件流，主窗隐藏时全屏画面继续刷新
- 进入：标题栏 ⛶ 按钮或 **F11**（主窗口内）；退出：**ESC**、右上 ✕
- 鼠标静止 3.2 秒自动淡出顶部/底部信息栏，移动即恢复，适合投屏
- `focus_main` 统一收起迷你窗与全屏窗；`show_fullscreen` 反向隐藏主窗/迷你窗
- 修复：`window-state` 插件原先连「可见性」一起恢复，导致上次退出时可见的迷你胶囊
  会在下次启动时自己冒出来（全屏截图里就抓到了）。现在只记忆 `POSITION | SIZE`，
  并在 `setup` 里再兜底隐藏迷你窗与全屏窗。
- 修复：持久化设置原先无条件信任 localStorage，导致同 identifier 的旧原型数据
  （「级别 4 · 正常」绿色级别）被原样加载。新增 `src/lib/settingsSchema.ts`：
  设置版本升到 2，旧版本直接回落默认值，当前版本做结构清洗
  （模式枚举、偏移 65–125、级别 1–8、阈值 0–120、颜色 hex、文本截断）。
  4 条单测覆盖，总测试 35 条。

## 验证证据

自动化脚本：`scripts/verify-p0.ps1`、`capture-settings.ps1`、`verify-p2.ps1`、`verify-p3.ps1`、
`verify-p4.ps1`、`verify-release.ps1`（启动 → 截图 → Win32 模拟点击）。

| 截图 / 检查 | 验证点 | 结果 |
| --- | --- | --- |
| `p0-a.png` | 实时读数 + 波形 + 设备名 | 正常 |
| `p0-c-reverse.png` | 真实麦克风 + 反向模式 + dwell | 39.1 ≤ 40 持续 2s 后命中「无声」转红 |
| `p0-d-paused.png` | 暂停 | 数字变灰、波形清空、麦克风释放 |
| `p1-alert-warning.png` | 模拟 78 dB 正向 | 命中「警告」琥珀 |
| `p1-alert-danger.png` | 模拟 88 dB 正向 | 命中「危险」红 |
| `p2-settings-levels-expanded.png` | 级别编辑器 | 阈值/名称/提示/颜色/删除齐全 |
| `p2-main-after-edit.png` | 改阈值后主页生效 | 阈值改到 93.5 后 68.9 dB 不再命中 |
| `p2-persisted.png` | 重启保留 | 阈值 93.5 仍在 |
| `p2-calibration-done.png` | 朗读校准 | 实测 71.0 → 偏移 94.0 |
| `p3-mini-a/b.png` | 胶囊 + 主窗隐藏时仍更新 | 两帧不同，持续刷新 |
| `p3-main-restored.png` | 点胶囊回主窗 | 正常恢复 |
| 关闭行为 | 进程存活、窗口隐藏 | alive=True / hidden=True |
| `p4-logs-alerts.png` / `p4-logs-samples.png` | 日志页筛选与采样 | 事件行 + 36 条采样 + 走势图 |
| CSV 导出 | 原生保存对话框 | `Documents\dbound-2026-10-24.csv`，2908 字节，UTF-8 BOM |
| JSONL 校验 | 磁盘日志 | 合法 JSON、中文正常、按天分文件 |
| `p5-release-main.png` | release 版 + 全新 WebView2 profile | 直接出读数 47.9 dB，无授权弹窗 |
| `p6-full-a.png` / `p6-full-b.png` | 全屏窗口（2560×1600）+ 持续刷新 | 两帧不同，读数随模拟信号变化 |
| `p6-main-restored.png` | ESC 退出全屏 | 主窗恢复、全屏隐藏 |
| F11 | 主窗快捷键进入全屏 | 通过 |
| 稳定性 | 90–120 秒采样 | 内存 31.2 MB（Δ ≈ 0 MB），CPU 0.05% |
| 单测 | `pnpm test` | 31 条全绿 |

## 开发命令

```powershell
$env:CARGO_HTTP_CHECK_REVOKE='false'   # 本机证书吊销检查不可用，拉 crates 需要

pnpm tauri dev                          # 热更新开发
pnpm tauri build                        # release + NSIS 安装包
pnpm tauri build --debug --no-bundle    # debug exe（自测用）
pnpm typecheck                          # tsc --noEmit
pnpm test                               # vitest

# UI 预览（无需麦克风，构建时合成信号）
$env:VITE_DBOUND_SIM='72'; $env:VITE_DBOUND_SIM_MODE='forward'; pnpm tauri build --debug --no-bundle
```

## 踩坑记录

1. **WebView2 多窗口必须使用相同的浏览器参数**。主窗口为禁用后台节流加了额外参数，迷你窗没加 →
   第二个 webview 创建失败（`HRESULT 0x8007139F 没有注册类`），表现为纯白窗口、页面从不加载。
   现在两个窗口在 `tauri.conf.json` 里配置**完全相同**的 `additionalBrowserArgs`。
2. **运行时创建窗口 + `WebviewUrl::App` 在 WebView2 上不可靠**，改为在 `tauri.conf.json` 预声明
   迷你窗（`visible: false`），运行时只负责 `show()` 与定位。
3. **打包版首次启动会遇到 WebView2 的浏览器式麦克风授权气泡**（debug 期因 profile 已授权没暴露），
   用 `--use-fake-ui-for-media-stream` 放行本地页面的媒体请求解决；系统级隐私开关仍需用户开启。
4. **Tailwind v4：无层级的元素样式会盖掉所有 utility**。`button { color: inherit }` 让选中态按钮
   变成黑底黑字——把基础样式放进 `@layer base` 才修复。
5. **cargo 走 tuna 镜像时需要关闭 Windows 证书吊销检查**（`CARGO_HTTP_CHECK_REVOKE=false`）。
6. **构建前要结束正在运行的 dbound.exe**，否则 NSIS/cargo 写文件报占用。

## 已知限制

- 仅 Windows；估测值受麦克风、系统增益、距离影响，未做 A 计权与频响补偿
- 开机自启与全局快捷键（PRD 可选）未接入；F11 只在主窗口聚焦时生效
- 全屏模式一次只覆盖主显示器；多显示器场景请把主窗拖到目标屏幕再进入
- 波形 Y 轴固定 20–100 dB，低于 20 贴底
- 安装包未在本机实际安装验证（避免改动系统）；其内嵌的 release 可执行文件已实测运行
- `%APPDATA%\com.dbound.desktop` 下可能存在更早期原型留下的 `dbound.log.*`
  与 `recordings/`，与本版本无关，不影响运行

## 1.0.1 Beta2（发布与授权）

- 版本号统一为 1.0.1（安装器 / 应用 / 包元数据），界面显示 `1.0.1 Beta2`
- 设置新增「关于」独立页（系统右侧），含版本、授权、隐私、作者：设计 / 创意 / 开发 | 作者：Source X
- 安装包：自定义 NSIS 模板
  - 安装向导新增「序列号验证」页，序列号 `142857`，错误则中止
  - 静默/被动安装必须传 `/SERIAL=142857`，否则以退出码 2 失败
  - 安装后写入 `HKCU\Software\dBound\License` 与安装目录 `license.dat`
  - 安装包图标、卸载图标使用应用图标；默认安装目录 `%LOCALAPPDATA%\dBound`，支持自定义路径
  - 安装目录包含 `dbound.exe`、`uninstall.exe`、`license.dat`、`文档/`（使用说明 / 版本信息 / LICENSE）
  - 开始菜单 `dBound` 文件夹 + 快捷方式；卸载时清理注册表激活标记
- 应用启动增加激活校验：缺少注册表标记时显示激活页，输入序列号后写入标记
- 验收脚本：`scripts/verify-installer.ps1`（静默安装/错误序列号/自定义目录/启停卸载）、
  `scripts/verify-about-activation.ps1`（关于页 / 激活页 / 激活成功）、
  `scripts/verify-installer-ui.ps1`（安装向导截图）
