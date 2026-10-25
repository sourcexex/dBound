# dBound 文档

本目录集中存放需求、进度、评审与截图。**协作规则、代码约定与完整文档规范见仓库根 [AGENTS.md](../AGENTS.md)**；面向用户的介绍见 [README.md](../README.md)。

## 文档地图

| 文件 | 职责 | 状态 | 维护方式 |
|---|---|---|---|
| [README.md](../README.md) | 用户向说明：功能、安装、使用、隐私、已知限制 | 活跃 | 功能变化时同步；不写内部 TODO |
| [PRD.md](PRD.md) | 需求规格（设计意图） | 设计基线 v0.3 + 顶部「实现状态核对」 | 需求变更先改这里，再在 PROGRESS 追加实现记录 |
| [PROGRESS.md](PROGRESS.md) | 开发进度、里程碑证据、版本一览 | 历史记录（按时间追加） | 只追加；历史事实不改写，修正用「编者注」 |
| [OPTIMIZATION.md](OPTIMIZATION.md) | 2026-10-25 优化项审计（56 项，P0/P1/P2 + 批次） | 评审基线（只读） | 整改后在对应项追加状态，不改原始结论 |
| `../docs-images/` | 文档截图 | 活跃 | 只放被引用或登记在下方截图库的图 |
| `../docs-images/archive/` | 过期/历史截图 | 归档 | 不再新增；仅供历史对照 |

> 待建：`RELEASE.md`（发布流程与检查单，见 OPTIMIZATION Batch 2）、`CHANGELOG.md`（首次对外发布前建立）。

## 阅读路径

- 新接手 / 想了解产品：根 README → PRD → PROGRESS
- 要改代码：AGENTS.md → PROGRESS「当前状态摘要」→ OPTIMIZATION 对应批次
- 要发版：OPTIMIZATION §6 Batch 2 → PROGRESS「版本一览」→ 待建的 RELEASE.md
- 要写文档：AGENTS.md §5「文档规范」→ 本页文档地图与截图库

## 截图库

### 文档引用（README）

| 文件 | 内容 | 引用位置 |
|---|---|---|
| `../docs-images/main-quiet.png` | 主界面（安静状态） | README 首图 |
| `../docs-images/alert-danger.png` | 命中级别时的主界面 | README 截图表 |
| `../docs-images/settings-levels.png` | 设置 · 级别编辑器 | README 截图表 |
| `../docs-images/logs.png` | 日志中心 | README 截图表 |
| `../docs-images/mini.png` | 迷你胶囊窗 | README 截图表 |
| `../docs-images/fullscreen.png` | 全屏投屏模式 | README |
| `../docs-images/snapshot-settings.png` | 证据录制与现场快照设置 | README |
| `../docs-images/snapshot-toast.png` | 快照触发提示 | README |
| `../docs-images/activation.png` | 首次启动激活界面 | README |

### 功能截图（备用）

| 文件 | 内容 |
|---|---|
| `../docs-images/settings-camera.png` | 设置 · 设备页（摄像头选择） |
| `../docs-images/settings-evidence-modes.png` | 设置 · 按模式留证 |
| `../docs-images/settings-idle-color.png` | 设置 · 未命中数字颜色 |
| `../docs-images/settings-levels-typography.png` | 设置 · 级别文字大小 |
| `../docs-images/settings-status-text.png` | 设置 · 状态文字 |
| `../docs-images/glow-main.png` | 主界面数字光晕 |
| `../docs-images/glow-fullscreen.png` | 全屏数字光晕 |
| `../docs-images/level-color-main.png` | 主界面级别配色 |
| `../docs-images/level-color-fullscreen.png` | 全屏级别配色 |
| `../docs-images/emoji.png` | 全屏表情互动 |
| `../docs-images/emoji-fluent-fullscreen.png` | 全屏 Fluent 表情 |

### 归档截图（过期，勿引用）

| 文件 | 归档原因 |
|---|---|
| `../docs-images/archive/installer-serial.png` | 安装器序列号页已移除（改为首次启动激活） |
| `../docs-images/archive/about.png` | 关于页版本号已过期 |
| `../docs-images/archive/activated-main.png` | 抓拍于滚筒动画中间态，数字残缺 |
| `../docs-images/archive/defaults-main.png` | 抓拍于滚筒动画中间态，数字残缺 |

## 变更记录

- **2026-10-25 文档整理**
  - 新建本索引、根 [AGENTS.md](../AGENTS.md)（含文档规范）、`scripts/verify-docs.ps1`（文档门禁）
  - `docs/GITHUB.md` 合并删除：版本演进表迁入 [PROGRESS.md](PROGRESS.md)「版本一览」，下载与介绍以根 README 为准（原文件链接指向被 gitignore 的 `release/`，在仓库内必 404）
  - 4 张过期截图移入 `../docs-images/archive/`
  - [PRD.md](PRD.md) 增加「实现状态核对」；[PROGRESS.md](PROGRESS.md) 增加「当前状态摘要」并修正过期交付物
  - 新增 [OPTIMIZATION.md](OPTIMIZATION.md)（2026-10-25 优化项审计）

## 维护约定

- 规则全文：AGENTS.md §5「文档规范」。
- 提交前运行 `pwsh scripts/verify-docs.ps1`（检查索引覆盖、相对链接、截图引用与禁用路径）。
- 截图生成：验收脚本统一输出到 `output/screenshots/`（已 gitignore）；只有需要长期引用的截图才复制进 `docs-images/`（本地目录，已 gitignore，不随仓库分发）并登记到本页截图库。
- 新增截图单张 ≤500KB；当前 6 张全屏/主界面截图仍超标（最大约 4.1MB），压缩计划列入 [OPTIMIZATION.md](OPTIMIZATION.md) D-06，不阻塞文档改动。
- 文档正文不写死应用版本号与发布包文件名（以 `src-tauri/tauri.conf.json` 与发布页为准）；历史文档（PROGRESS/OPTIMIZATION）保留当时的版本表述。
