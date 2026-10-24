# dBound 开发进度

> 规格见 [PRD.md](PRD.md)（v0.3）。本文件记录每个里程碑的完成情况与验证证据。

## 当前状态：P4 完成，P5 进行中

| 里程碑 | 状态 | 说明 |
| --- | --- | --- |
| S 技术验证 | ✅ 并入 P0 | WebView2 里 `getUserMedia` 实测可用，无需额外兜底 |
| P0 采集 + 主界面 | ✅ | 实时读数、波形、暂停、错误态、单测 |
| P1 报警引擎 | ✅ | dwell / hysteresis / exitDwell 三层防抖 + 切换动效 |
| P2 设置与校准 | ✅ | 五段设置页、级别编辑器、两种校准、设备切换、重启保留 |
| P3 迷你胶囊 + 托盘 | ✅ | 置顶胶囊、跨窗口推流、托盘常驻、关闭到托盘 |
| P4 日志中心 | ✅ | 事件 + 每秒采样、按天 JSONL、应用内查看/筛选/搜索、CSV 导出 |
| P5 打包与终检 | ⏳ 进行中 | NSIS 安装包、README、稳定性自测 |

### P4 日志中心
- Rust `logs.rs`：按天写 `%APPDATA%\com.dbound.app\logs\YYYY-MM-DD.jsonl`
  - 事件（alert/device/system）+ 每秒采样（sample）
  - 保留 7 天、总量 20 MB，启动后首次写入时自动清理最旧文件
  - 命令：`log_append / log_days / log_read / log_clear / log_export / log_dir`
- 前端 `logger.ts`：4 秒或 25 条批量落盘，`pagehide`/隐藏时强制 flush，绝不阻塞测量
- 日志页：日期选择、四种筛选（触发/采样/设备/系统）、关键词搜索、当日采样统计 +
  迷你走势图、CSV 导出（原生保存对话框）、两步确认清空
- 标题栏日志入口带未读红点（有新触发时出现）

## 验证证据

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

## 验证证据

自动化脚本：`scripts/verify-p0.ps1`、`capture-settings.ps1`、`verify-p2.ps1`、`verify-p3.ps1`
（启动 debug 构建 → 截图 → Win32 模拟点击）。

| 截图 | 验证点 | 结果 |
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

单测：`pnpm test` 31 条（dB 换算、平滑、级别命中、阈值校验、校准公式、报警引擎）。

## 开发命令

```powershell
$env:CARGO_HTTP_CHECK_REVOKE='false'   # 本机证书吊销检查不可用，拉 crates 需要

pnpm tauri dev                          # 热更新开发
pnpm tauri build --debug --no-bundle    # 生成 debug exe（自测用）
pnpm typecheck                          # tsc --noEmit
pnpm test                               # vitest

# UI 预览（无需麦克风，构建时合成信号）
$env:VITE_DBOUND_SIM='72'; $env:VITE_DBOUND_SIM_MODE='forward'; pnpm tauri build --debug --no-bundle
```

## 踩坑记录

1. **WebView2 多窗口必须使用相同的浏览器参数**。主窗口为禁用后台节流加了
   `--disable-background-timer-throttling` 等参数，迷你窗没加 →
   第二个 webview 创建失败（`HRESULT 0x8007139F 没有注册类`），表现为纯白窗口、页面从不加载。
   现在两个窗口在 `tauri.conf.json` 里配置**完全相同**的 `additionalBrowserArgs`。
2. **运行时创建窗口 + `WebviewUrl::App` 在 WebView2 上不可靠**，改为在 `tauri.conf.json` 预声明
   迷你窗（`visible: false`），运行时只负责 `show()` 与定位。
3. **cargo 走 tuna 镜像时需要关闭 Windows 证书吊销检查**，否则报 `CRYPT_E_REVOCATION_OFFLINE`。
4. **构建时若上一个 exe 还在运行会报文件占用**，构建脚本前先结束 `dbound` 进程。

## 待办 / 已知限制

- P4：日志中心（事件 + 每秒采样、筛选、搜索、CSV 导出、按天滚动、7 天保留）
- P5：NSIS 打包、应用图标细化、README、长时间稳定性自测
- 开机自启与全局快捷键（PRD 可选，默认关）尚未接入
- 迷你窗首次定位依赖哨兵坐标；窗口位置记忆交给 window-state 插件
- 波形 Y 轴固定 20–100 dB，低于 20 贴底（可考虑自适应）
- `identifier` 建议从 `com.dbound.app` 改为 `com.dbound.desktop`（避免 Tauri 的 macOS 扩展名告警）
