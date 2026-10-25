# AGENTS.md

> 面向在本仓库工作的 AI Agent 与人类协作者。**改代码或改文档前先读本文**；面向用户的介绍见 [README.md](README.md)，文档索引见 [docs/README.md](docs/README.md)。

## 1. 项目速览

dBound 是 Windows 桌面「响度哨兵」：用麦克风实时估测环境响度，在课堂/自习场景按自定义级别做**仅视觉**提醒。

- **技术栈**：Tauri 2 + React 19 + TypeScript + Vite + Tailwind CSS v4 + zustand；Rust 只负责窗口/托盘/授权/日志/证据 IO，音频采集与 DSP 全部在前端 Web Audio。
- **三个窗口**：`main`（420×640 无边框透明）、`mini`（158×58 置顶胶囊）、`full`（全屏投屏，独立 HTML 入口）。**主窗是唯一数据源**，副窗通过 Tauri 事件 `dbound:mini-state` 接收状态（暂停态首帧存在缺口，见 OPTIMIZATION S-03）。
- **数据**：设置存 WebView `localStorage`（`dbound.settings`，`SETTINGS_VERSION=2`）；日志写 `%APPDATA%\com.dbound.desktop\logs\YYYY-MM-DD.jsonl`；证据录制/快照只写用户指定目录。
- **现状**：功能完整，但版本号、图标链路、设置迁移、发布设施存在问题；完整清单见 [docs/OPTIMIZATION.md](docs/OPTIMIZATION.md)。

## 2. 环境与常用命令

要求：Windows 10 1809+ / 11 x64；Node.js 20+；pnpm；Rust **1.90+**（`tauri` 2.12 的实际要求；`Cargo.toml` 目前声明 1.77.2 属待修项 E-05）；WebView2 运行时。

```powershell
pnpm install
pnpm dev              # Vite 开发服务器 :1420
pnpm typecheck        # tsc --noEmit（当前唯一静态门禁）
pnpm test             # vitest run（alertEngine / dsp / fluentEmoji / settingsSchema）
pnpm tauri dev        # Tauri 开发（热更新 + 三个窗口）
pnpm tauri build      # ver:check + tsc + vite build + NSIS 打包
```

- **版本单一来源**：`src-tauri/tauri.conf.json` 的 `version`（纯 `x.y.z` semver）；
  `node scripts/version.mjs check` 校验 `package.json` / `Cargo.toml` / `resources/版本信息.txt` 一致，
  `node scripts/version.mjs set <x.y.z>` 一处修改全部同步；`pnpm build` 已内置 check。
  前端显示用 Vite `define` 注入的 `__APP_VERSION__`，不要再硬编码版本字符串。

- 本机 cargo 若走镜像报 `CRYPT_E_REVOCATION_OFFLINE`，构建前执行 `$env:CARGO_HTTP_CHECK_REVOKE = 'false'`。
- **无 lint / format 脚本**（计划引入 Biome，见 E-06）。改动请保持现有风格：单引号、无分号、2 空格缩进。
- 图标重生成（手动，待脚本化 I-03）：`python scripts/make-icon.py` → `pnpm tauri icon icon-source.png` → 核对 `src-tauri/icons/`。
- 验收脚本：`scripts/verify-*.ps1`（多数依赖已安装的 release 产物，部分断言已过期，见 E-14）。
- 受限沙箱里 `vitest` 可能因 `child_process` 管道 EPERM 失败：属环境限制，到本地终端/CI 重跑，并在汇报中注明「未验证」。

## 3. 目录职责

| 路径 | 职责 |
|---|---|
| `src/pages/` | 主界面、设置、日志、迷你窗、全屏、激活页 |
| `src/components/` | 读数/波形/标题栏等组件；`settings/` 为 7 个设置面板；`ui/` 为通用控件 |
| `src/hooks/useLevelMonitor.ts` | 采集 + 平滑 + 报警 + 日志 + 跨窗口推流的编排 |
| `src/lib/` | `dsp`、`alertEngine`、`settingsSchema`、`audio/`、`logger`、`miniBridge`、`theme` 等纯逻辑 |
| `src/stores/` | zustand：`settings`（持久化）、`level`（实时状态） |
| `src-tauri/src/` | `lib.rs` 窗口/托盘/命令、`license.rs`、`logs.rs`、`evidence.rs` |
| `src-tauri/icons/` | 应用图标（由 `icon-source.png` 生成，勿手改） |
| `resources/` | 随安装包分发的文档（使用说明、版本信息、许可） |
| `scripts/` | 图标生成、构建/验收脚本；截图输出到 `output/screenshots/`（不入库） |
| `docs/` | 需求、进度、优化项、截图；索引见 `docs/README.md` |
| `dist/`、`release/`、`output/`、`src-tauri/target/`、`src-tauri/gen/` | 构建产物，已 gitignore，**不要提交** |

## 4. 代码约定

### 4.1 前端

- 函数组件 + hooks；zustand 按字段订阅（`useSettingsStore((s) => s.xxx)`），不要在组件里整对象解构。
- 样式用 Tailwind 工具类 + `src/styles.css` 中的设计 token（`paper/ink/line/...`）；仅动态值（颜色、字号）用内联 `style`。
- UI 文案统一中文；术语见 §5.3。
- **设置项新增流程（强制）**：
  1. `src/lib/settingsSchema.ts`：`PersistedSettings` 类型、默认值常量、`defaultSettings()`、`sanitizeSettings()` 校验（必要时加迁移）；
  2. `src/stores/settings.ts`：state 字段 + setter + `partialize`；
  3. `src/components/settings/*` 面板 UI；若需跨窗口生效，同步 `src/lib/miniBridge.ts` 的 `MiniState` 与 `src/hooks/useLevelMonitor.ts` 的 `publishMiniState`；
  4. `src/lib/settingsSchema.test.ts` 补用例；
  5. 按 §5.5「变更同步矩阵」更新文档。
  禁止在 `MiniPage`/`FullPage` 的 `INITIAL` 里另写一份默认值（S-07）。
- 跨窗口：**主窗唯一写者，副窗只读**；新增状态必须走事件流，并考虑「暂停/启动前」首帧（S-03）。

### 4.2 Rust / Tauri

- 命令命名 `snake_case`，返回 `Result<T, String>`；新增命令要同时加进 `generate_handler!` 与 `capabilities/*.json` 权限（最小权限）。
- 文件写入必须校验路径：拒绝 `..` 与绝对路径逃逸，限制后缀与大小上限（E-11）；大二进制走 base64 或 raw IPC（E-09）。
- 窗口/托盘操作集中在 `lib.rs`；前端不直接调窗口 API 时应删掉对应 capability。
- `tauri.conf.json` 是 JSON，不能写注释；`version` 为唯一版本来源，必须是纯 `x.y.z` semver；
  改版本用 `node scripts/version.mjs set <x.y.z>`，不要手改多个文件（V-01/V-02 已整改）。
- `additionalBrowserArgs` 目前在三窗口重复（E-02），改动需三处同步，直到收敛。
- `window-state` 只恢复 `POSITION | SIZE`，**不要恢复可见性**（否则迷你窗/全屏窗会在下次启动时自己弹出）。

### 4.3 安全红线

- 不引入远程 URL / 远程脚本；新增资源必须本地。
- 不提交证书、私钥、序列号私钥；不在 README/文档/日志中暴露激活码。
- 不弱化 `--use-fake-ui-for-media-stream` 的本地页面前提；改动 CSP、导航白名单、capabilities 必须在 OPTIMIZATION 安全项（E-02/E-07）记录。
- 不擅自扩大 IPC 能力；不新增「任意路径写」命令。

### 4.4 Git

- 不提交 `dist/`、`release/`、`output/`、`src-tauri/target/`、`src-tauri/gen/`。
- 重命名用 `git mv`；不 force push；不在主分支直接提交大二进制或截图压缩包。
- 提交前 `git status` 应只有预期改动；生成物、临时脚本不要留在工作区。

## 5. 文档规范

### 5.1 原则

1. **单一来源**：同一事实只写一处。README = 用户向；PRD = 需求意图；PROGRESS = 历史；OPTIMIZATION = 评审与整改；AGENTS = 协作规则；docs/README = 文件索引。
2. **可验证**：给命令、`文件:行`、截图或复现步骤；不写无法复核的形容词。
3. **不写易漂移值**：应用版本号、安装包文件名、文件大小、绝对路径。必须提及时写「以 `tauri.conf.json` 为准」或给发布页链接；历史文档保留当时表述并注明日期。
4. **历史只追加**：PROGRESS 的历史段落不改写；修正用「编者注（YYYY-MM-DD）」或新增段落。
5. **用户向与内部向分离**：README 不写 TODO、内部代号、已知缺陷清单（放 OPTIMIZATION）；内部文档不面向最终用户承诺功能。

### 5.2 文档职责与状态

| 文档 | 职责 | 状态标记 | 维护方式 |
|---|---|---|---|
| `README.md` | 用户向：功能、安装、使用、隐私、已知限制 | 活跃 | 功能变化时同步；不写内部事项 |
| `docs/README.md` | **文件级索引**：文档地图、截图库、归档、维护约定 | 活跃 | 新增/删除文档与截图必须在此登记 |
| `docs/PRD.md` | 需求规格（设计意图） | 设计基线 | 需求变更先改此处，并维护顶部「实现状态核对」 |
| `docs/PROGRESS.md` | 里程碑完成情况、验证证据、版本一览 | 历史 | 只追加；当前状态用顶部摘要 |
| `docs/OPTIMIZATION.md` | 优化项审计与整改批次 | 评审基线（只读） | 整改后在对应项追加状态，不改原始结论 |
| `docs-images/` | 文档截图（本地资产，已 gitignore，不提交） | 活跃 | 仅放被引用或登记在截图库的图 |
| `docs-images/archive/` | 过期/历史截图（本地，不提交） | 归档 | 不再新增；仅供历史对照 |

- 新增文档：先在 `docs/README.md` 登记（文件、职责、状态），再写内容。
- 归档文档：移入 `docs/archive/`，在 `docs/README.md` 变更记录里说明原因。

### 5.3 写法与术语

- 语言：中文为主；英文术语首次出现给中文；代码/命令/路径/字段用反引号。
- 结构：H1 唯一；H2 分节；长文开头写「文档状态 / 适用范围 / 更新日期」；更新在顶部或文末标注。
- 日期 `YYYY-MM-DD`；文档自身版本（如 `v0.3`）与应用版本分开写，不混用。
- 术语表（统一用法）：

| 用 | 不用 | 说明 |
|---|---|---|
| dBound | Dbound / DBOUND | 产品名大小写固定 |
| 估测分贝 / 估测值 | 测量分贝、精确分贝 | 非声级计计量 |
| 正向模式（默认名「自习课模式」） | 噪音模式 | 太吵报警 |
| 反向模式（默认名「早读模式」） | 静音模式 | 太小声报警 |
| 级别 | 档位、阈值组 | `{threshold,name,note,color,enabled}` |
| 证据录制 / 现场快照 | 录音、拍照 | 触发时保存 WAV / JPG |
| 全屏模式 / 迷你窗 / 托盘 | 大屏、小窗、任务栏图标 | 三窗口与托盘 |
| 校准偏移 | 增益、灵敏度 | `offset`，估测 dB 的偏移值 |

- 单位：`dB`、`px`、`s`、`Hz` 用英文；正文可写「秒」「像素」。
- 标点：中文全角；短标签不加句号；完整说明句加句号。
- 标题与按钮文案：动词开头、不超过 8 字（模式名/级别名等用户可改内容除外）。

### 5.4 图片规范

- 位置：仓库根 `docs-images/`（**已被 .gitignore 忽略，不提交**）；命名 kebab-case，前缀表示用途：`main-`、`fullscreen-`、`settings-`、`mini-`、`alert-`、`logs-`、`diagram-`。
- 文档中引用时按文件位置写相对路径：根 README 用 `docs-images/...`，`docs/*.md` 用 `../docs-images/...`。
- 要求：反映当前实现（版本、默认值、主题）；宽度 ≤1280px；**新增图片**单张 ≤500KB（超出转 WebP/JPEG）；现存超限图按 OPTIMIZATION D-06 逐步压缩，不阻塞文档改动；不得含个人信息或临时调试 UI。
- 只保留**被文档引用**或**登记在 `docs/README.md` 截图库**的图；过期图移入 `docs-images/archive/` 并在索引注明原因。
- 验收/取证截图统一输出到 `output/screenshots/`（gitignored），不要直接写入 `docs-images/`。
- 抓图前让动画落定（滚筒数字、呼吸环），避免半帧/残影（参见 D-01）。

### 5.5 变更同步矩阵

| 你改了什么 | 必须同步 |
|---|---|
| 设置项 / 默认值 / 文案 | `settingsSchema` 测试；README 功能清单；PRD 状态核对；PROGRESS 追加 |
| 窗口 / 交互 / 快捷键 / 托盘 | README 使用步骤；PRD 状态核对 |
| 版本 / 打包 / 依赖 / 资源 | AGENTS §2 命令区；OPTIMIZATION 对应项；**不写进 README 正文** |
| 安全 / CSP / 权限 / 授权 | OPTIMIZATION 安全项；AGENTS §4.3 |
| 脚本 / 构建流程 / 目录结构 | AGENTS §2/§3；`docs/README.md`（若新增文档） |
| 新增截图 | `docs/README.md` 截图库登记 |
| 删除/归档文档 | `docs/README.md` 变更记录 |

### 5.6 提交前检查（文档）

- [ ] 新文档/截图已在 `docs/README.md` 登记
- [ ] 无死链；无指向 `release/`、`output/` 的链接；无写死版本号/安装包名
- [ ] 截图有效、体积达标、未新增过期图
- [ ] 设置项、默认值、命令与实际代码一致
- [ ] 历史段落未被改写（只追加/加编者注）
- [ ] `pwsh scripts/verify-docs.ps1` 通过

### 5.7 自动化检查

`scripts/verify-docs.ps1` 是文档门禁，检查：

1. `docs/` 下每个 Markdown 都在 `docs/README.md` 索引中出现；
2. 所有 Markdown 相对链接/图片目标存在（跳过 http、锚点）；
3. 禁止 Markdown 链接指向 `release/` 或 `output/`；
4. 根 README 与 docs 中引用的 `docs-images/**` 文件在本地存在（该目录不入库，干净克隆下跳过）；
5. `docs-images/**` 中每个文件都在某份 Markdown 中被提及（含截图库/归档说明，目录存在时检查）；
6. 警告项：根 README、`docs/README.md`、`docs/PRD.md` 中出现疑似写死的应用版本号；`docs-images/` 中活动截图超过 500KB（压缩计划见 D-06，不阻塞）。

失败时退出码非 0，输出 `FAIL <文件>:<行>: <原因>`；成功输出 `PASS`。文档改动提交前必须通过。

## 6. 交付与验证

1. `pnpm typecheck` 必须通过；`pnpm test` 能跑则跑（受限环境失败要注明）。
2. 手动冒烟：主窗读数/暂停、设置持久化（重启后保留）、迷你窗、全屏 F11/ESC、托盘菜单、激活门。
3. 打包：`pnpm tauri build`；核对版本、图标、`resources/` 文档是否随包、安装包文件名。
4. 汇报：说明改了什么、验证命令与结果、遗留风险与对应 OPTIMIZATION 编号。
5. 发版：未签名不发包（目标状态）；流程与产物矩阵见 OPTIMIZATION §6 Batch 2。

## 7. 新会话起点

- 当前状态：`docs/PROGRESS.md`「当前状态摘要」+「里程碑状态」。
- 待办与批次：`docs/OPTIMIZATION.md` §6；需产品决策的 7 项见 §8。
- 已完成：V-01/V-02（版本单一来源，v0.1.0）、V-05/D-05（GITHUB.md 删除）、V-08（verify 脚本不再写死版本路径）。
- 下一个建议任务：Batch 1 剩余项（图标统一 I-01～I-03、设置迁移/导入导出 S-01～S-04、单实例 E-11）。
- 改动前先看对应 OPTIMIZATION 编号，避免重复踩坑；改动后按 §5.5 同步文档。
