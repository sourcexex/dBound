# dBound 开发进度

> 规格见 [PRD.md](PRD.md)（v0.3）。本文件记录每个里程碑的完成情况与验证证据。

## 当前状态：P1 完成 ✅

| 里程碑 | 状态 | 说明 |
| --- | --- | --- |
| S 技术验证 | ✅ 直接并入 P0 | 无需单独 spike：WebView2 里 `getUserMedia` 实测可正常取流 |
| P0 采集 + 主界面 | ✅ 完成 | 见下方验证 |
| P1 报警引擎 | ✅ 完成 | dwell / hysteresis / exitDwell 三层防抖 + 级别切换动效 |
| P2 设置与校准 | ⏳ 下一步 | |
| P3 迷你胶囊窗 + 托盘 | 待做 | |
| P4 日志中心 | 待做 | |
| P5 打包与终检 | 待做 | |

## P1 已完成

- [x] `src/lib/alertEngine.ts`：有状态报警引擎
  - 入场持续 `dwell` 2000ms（尖峰不会直接触发）
  - 回落滞回 `hysteresis` 3dB（读数卡在阈值线上不会抖动）
  - 退场持续 `exitDwell` 1000ms
  - 级别升降级同样走 dwell，输出 `enter / exit` 事件（P4 日志直接消费）
  - 级别被禁用/删除时立即释放
- [x] 引擎接入 30Hz 读数管线；模式切换、暂停、错误时自动 reset
- [x] 主界面改为读取引擎输出的 `activeLevel`（不再瞬时判断）
- [x] 级别变色 + 光晕 + 呼吸扩散环（`dbound-ripple`，900ms 一次）
- [x] 单测：`alertEngine.test.ts` 13 条（迟滞、退场、升降级、禁用级别、自定义 dwell）
  总计 27 条测试全绿
- [x] 新增 UI 预览能力：`VITE_DBOUND_SIM=<dB> [VITE_DBOUND_SIM_MODE=forward|reverse]` 构建时合成信号，
      无需麦克风即可截图/调界面

## 验证证据

`scripts/verify-p0.ps1` 自动启动 debug 构建、截图、模拟点击：

| 截图 | 验证点 | 结果 |
| --- | --- | --- |
| `output/screenshots/p0-a.png` | 实时读数 + 波形流入 + 设备名 | 正常 |
| `output/screenshots/p0-c-reverse.png` | 真实麦克风 + 反向模式 + dwell | 39.1 dB ≤ 40 持续 2s 后命中「无声」转红 |
| `output/screenshots/p0-d-paused.png` | 暂停 | 数字变灰、波形清空、麦克风释放 |
| `output/screenshots/p0-e-resumed.png` | 恢复 | 重新采集 |
| `output/screenshots/p1-alert-warning.png` | 模拟 78 dB 正向 | 命中「警告」琥珀色 |
| `output/screenshots/p1-alert-danger.png` | 模拟 88 dB 正向 | 命中「危险」红色 |

## P0 已完成

- [x] Tauri 2.12 + React 19 + TS + Tailwind v4 脚手架，自绘无边框标题栏
- [x] Web Audio 采集链路：关闭回声消除/降噪/AGC（失败回退 `{audio:true}`）、AnalyserNode 2048、
      `getFloatTimeDomainData` + byte 回退、rAF + 100ms 定时器双驱动、逐层 `disconnect` + `track.stop`
- [x] 信号处理：RMS → dBFS → `+offset` → 估测 dB；帧级 EMA(0.72/0.28) + 显示级时间加权
      （正向 125ms / 反向 1s / 朗读 3s）
- [x] 30 Hz 读数推送、3 秒峰值保持、60 秒波形（Canvas，含各级阈值虚线）
- [x] 主界面：中央 108px 估测读数 + `≈` + 级别胶囊 + 提示文字；命中级别时数字/光晕/波形同步换色
- [x] 正/反向模式切换（反向默认 Slow + 朗读平滑）
- [x] 暂停/恢复：真正释放麦克风（`track.stop` + `AudioContext.close`），无需重启
- [x] 错误态：权限拒绝 / 无设备 / 占用 / 不支持，分类文案 + 重试；`suspended` 时提示一次点击
- [x] 单测：`src/lib/dsp.test.ts` 14 条（dB 换算、平滑、级别命中、阈值校验）全绿
- [x] 应用图标（`scripts/make-icon.py` 生成 → `tauri icon`）

## 验证证据

`scripts/verify-p0.ps1` 自动启动 debug 构建、截图、模拟点击：

| 截图 | 验证点 | 结果 |
| --- | --- | --- |
| `output/screenshots/p0-a.png` | 实时读数 + 波形流入 + 设备名 | 53.9 dB，波形有数据 |
| `output/screenshots/p0-c-reverse.png` | 反向模式命中级别 | 43.6 dB ≤ 50 → 命中「过小」，整屏转琥珀色 |
| `output/screenshots/p0-d-paused.png` | 暂停 | 数字变灰、波形清空、状态「已暂停 · 麦克风已释放」 |
| `output/screenshots/p0-e-resumed.png` | 恢复 | 重新采集，18.5 dB 命中「无声」，转红 |

## 本地运行

```powershell
# 开发（Vite + Tauri 热更新）
pnpm tauri dev

# 生产构建（debug 版，不含安装包）
pnpm tauri build --debug --no-bundle

# 类型检查 / 单测
pnpm typecheck
pnpm test
```

> 注意：本机 cargo 走 tuna 镜像，且 Windows 证书吊销检查不可用，
> 构建时需 `$env:CARGO_HTTP_CHECK_REVOKE = 'false'`，否则拉取 crates 会报
> `CRYPT_E_REVOCATION_OFFLINE`。

## 已知待办（进入 P1/P5 时处理）

- `tauri.conf.json` 的 identifier 以 `.app` 结尾，Tauri 会警告 macOS 扩展名冲突；Windows-only 项目可改为 `com.dbound.desktop`。
- `output/` 已加入 .gitignore（截图产物不入库）。
- 波形 Y 轴可视范围固定 20–100 dB，低于 20 时贴底；P1 可做自适应范围。
