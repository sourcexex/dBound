# dBound 优化项分析报告

> 审计日期：2026-10-25 ｜ 基线：`master` @ `3c19a1a` ｜ 版本：1.0.1（展示名「1.0.1 Beta2」）
> 方法：只读审计（未改任何源码/配置/图标）；四路并行审计 + 交叉复核；`tsc --noEmit` 通过；核对了构建产物、PE 版本资源、ICO/ICNS 结构、git 索引与依赖实际版本。
> 详细分报告（含全部 file:line、命令输出、复现片段）：
> `output/analysis/icons.md`（12 项）、`output/analysis/version.md`（14 项）、`output/analysis/settings.md`（22 项）、`output/analysis/engineering.md`（31 项）。
> 本报告为合并去重后的总清单：**56 项核心优化项**（另含缺失设置建议 9 项、待确认决策 7 条），按优先级与落地批次组织。

> **文档整理说明（2026-10-25）**：本报告写定后，`docs/` 已按新建的文档规范整理——`docs/GITHUB.md` 合并删除（版本演进迁入 `docs/PROGRESS.md`）、4 张过期截图移入 `docs/images/archive/`、新增 `docs/README.md` 索引与根 `AGENTS.md`，并修复了 `PRD.md`/`PROGRESS.md` 的过期状态。本文保留为**当时的审计快照**，正文中涉及 `GITHUB.md` 的路径引用与「24 张截图」等描述属于历史证据，不再逐条改写；涉及截图的证据路径已改为归档位置。

---

## 整改状态（追加，2026-10-25）

- **V-01 / V-02 已整改**：版本统一为 semver `0.1.0`，`tauri.conf.json` 为唯一来源，
  `scripts/version.mjs check` 校验 package.json / Cargo.toml / resources/版本信息.txt 一致性，
  并接入 `pnpm build` 前置；展示层改为 Vite `__APP_VERSION__` 注入，不再硬编码。
- **V-05 / D-05 部分整改**：删除 `docs/GITHUB.md`（内容合并进 README）；README 中的写死版本号与
  `release/` 产物路径已移除。
- 其余项（图标、设置迁移、CSP/授权、离线安装、单实例、签名/CI、截图压缩等）保持原结论，待批次执行。
- **资源外置（补充）**：Fluent Emoji 图片不再嵌入 exe，改由安装器释放到 `resources/`，
  主程序体积约 19MB → 3.5MB；同时保留离线可用（资源随包，无远程 URL）。

---

## 0. 结论速览

### 0.1 做得好的地方（不要「优化」掉）

- 前端**零远程资源、零 `eval`/`dangerouslySetInnerHTML`**（唯一 URL 是 `AuroraBackground.tsx:73` 的 data: SVG），CSP 落地成本极低。
- 依赖**零漂移**：16 个包声明版本 = `node_modules` 实际版本；Rust 依赖面很小（6 个）。
- `.gitignore` 干净：`dist/release/output/node_modules/target/gen` 均未被跟踪；`Cargo.lock` 已入库。
- 设置读盘有结构清洗（`sanitizeSettings`）与版本门（`SETTINGS_VERSION=2`），方向正确。
- 三窗口架构清晰：主窗口是唯一数据源，迷你/全屏靠 Tauri 事件推流，避免了多份采集。
- Windows 适配到位：无边框透明窗口、托盘、窗口位置记忆（只恢复位置与尺寸）、GPU 优化（PROGRESS 有实测数据）。
- release profile 已做 `lto + codegen-units=1 + opt-level="s" + panic="abort" + strip`。

### 0.2 风险 Top 10

| # | 风险 | 证据 | 级别 |
|---|---|---|---|
| 1 | 激活码 `142857` 明文硬编码，且 README / 随包 `使用说明.txt` 公开；注册表标记只校验「非空」→ `reg add` 即永久激活 | `license.rs:7,16-22`；`README.md:85`；`resources/使用说明.txt:11` | P0 |
| 2 | 设置版本升级会**丢弃全部用户配置**且无备份/导入导出 | `settingsSchema.ts:434-437`；`stores/settings.ts:284-325` | P0 |
| 3 | 版本双轨：`1.0.1`（系统层）× `1.0.1 Beta2`（展示层），21 处硬编码零校验；"Beta2" 不是合法 semver | `tauri.conf.json:4` vs `App.tsx:15` 等 | P0 |
| 4 | 离线教室机装不上：`webviewInstallMode=downloadBootstrapper` 必须联网拉 WebView2 | `tauri.conf.json:99-102` | P0 |
| 5 | 发布不可追溯：安装包未签名、无 CI、无 tag、`release/` 被 gitignore；构建目录还残留 `dBound_0.1.0_x64-setup.exe` | 无 `signCommand`；`target/release/bundle/nsis/` | P0 |
| 6 | 无 CSP + 三窗口 `--use-fake-ui-for-media-stream` 自动放行麦克风/摄像头 + `log_export`/`save_evidence` 可写任意路径 | `tauri.conf.json:71-73,28,45,64`；`logs.rs:174-176`；`evidence.rs:24-54` | P0（纵深防御） |
| 7 | 无单实例：双击两次 = 两个进程、两只托盘、两路麦克风、并发写日志 | 无 `tauri-plugin-single-instance` | P1 |
| 8 | 托盘图标复用 32px 全彩应用图标：16px 下 5 柱塌成细线，`#131316` 对 Win11 深色任务栏对比度 1.14:1 | `lib.rs:190-192` | P1 |
| 9 | 跨窗口在「暂停/启动前」断流：全屏/迷你显示硬编码旧默认（`dBound`、600ms、`音量正常`） | `FullPage.tsx:60-91`；`MiniPage.tsx:6-37`；`useLevelMonitor.ts:226-229` | P1 |
| 10 | 文档漂移：`defaults-main.png` 读数碎片、`installer-serial.png` 已过期、`docs/GITHUB.md` 下载链接必 404、PROGRESS 交付物仍写 0.1.0、README 默认值描述过期 | 见 §5 | P1 |

### 0.3 问题分三层

1. **用户点名的三件事**（图标 / 版本 / 设置）→ 大多是「资产用错、来源不唯一、默认值分散」，属于**低成本、高感知**，建议作为第一批。
2. **发布级工程设施**（授权、签名、CI、离线包、CSP、单实例）→ 不是代码烂，而是「没建起来」，决定能不能对外发。
3. **文档与需求一致性**（PRD v0.3 / PROGRESS / README / GITHUB 互相矛盾）→ 影响协作与用户预期，必须与代码同步收口。

---

## 1. 图标与品牌（用户点名 ①）

**总体结论：图标资产本身是健康的**——`icon-source.png` 与 `scripts/make-icon.py` 输出像素级一致；15 个 PNG + 6 个 ICO 帧 + ICNS 全部同源下采样（meanAbs ≤ 0.21）；exe/安装包图标均为 `icon.ico`；无白底/黑边，圆角透明；品牌写法统一（`dBound` 57 次，无 `DBound` 变体）。**问题都出在「哪里用了什么」，而不是「图标画错了」**。

| ID | 级别 | 问题 | 证据 | 修复建议 | 工作量 |
|---|---|---|---|---|---|
| I-01 | P1 | 托盘图标 = 32px 全彩应用图标的二段缩放（exe 资源 32px → Shell 16px）。16px 帧亮像素仅 37/256，5 柱塌成 4–5 条 1–2px 竖线，柱间 1px 缝消失；主体 `#131316` vs Win11 深色任务栏 `#202020` 对比度 **1.14:1**，外轮廓看不见。关闭主窗即进托盘 → 深色任务栏用户找不到图标 | `src-tauri/src/lib.rs:190-192`（`default_window_icon`）；`tauri-codegen context.rs:211-214` | 新增专用托盘素材（16/20/24/32，**3 柱、柱宽 ≥2px、带 1px 亮描边或浅色底**），`lib.rs` 改用 `include_bytes!` + `Image::from_bytes`；托盘图标不要跟随主题变色，保持深/浅任务栏都可辨 | 0.5d |
| I-02 | P1 | 应用内没有复用图标母题，三处品牌标记互不相同：标题栏是「深色方块 + 6px 琥珀圆点」（`TitleBar.tsx:53-55`），激活页用 lucide `ShieldCheck`（`ActivationPage.tsx:43-45`），关于页纯文字无 logo（`AboutPanel.tsx:5-31`），全仓 TSX 对图形资产 0 引用 | `TitleBar.tsx:53-55`；`ActivationPage.tsx:43-45`；`AboutPanel.tsx:5-31` | 抽一个 `<BrandMark>`（内联 SVG 或 32/48/64 PNG），标题栏、激活页、关于页、迷你窗统一使用；关于页加 64px logo + 版本行 | 0.5d |
| I-03 | P1 | 图标生成链路不可复现：`package.json` 无 icon 脚本，仅 `make-icon.py:1` 注释提到 `tauri icon`；27 个 `verify-*.ps1` 里没有图标校验。改源图后没有任何机制保证重生成 | `package.json:7-14`；`scripts/make-icon.py:1` | `"icon": "python scripts/make-icon.py && tauri icon icon-source.png"`；新增 `scripts/verify-icons.ps1`（断言 17 个文件存在、尺寸矩阵、ICO 帧含 16/24/32/48/64/128/256、16px 非空像素阈值） | 0.5d |
| I-04 | P2 | `icon.ico` 6 帧 = 16/24/32/48/64/256，**缺 128**；6 帧全 PNG 压缩（部分旧系统/工具偏好 BMP 帧） | `src-tauri/icons/icon.ico`（PIL/ICONDIR dump 见 icons.md 附录 A） | 用 PIL 重新打包 16/24/32/48/64/128/256，混合 PNG+BMP；顺手修 `bundle.icon` 补 `icons/icon.png`（Linux 兜底会取 32px） | 0.5h |
| I-05 | P2 | 安装向导无品牌图：实际生成的 `installer.nsi:45,47` 中 `HEADERIMAGE`/`SIDEBARIMAGE` 为空 → 向导左侧是 NSIS 默认蓝色图；`docs/images/archive/installer-serial.png` 是**过期截图**（自定义序列号页已在 `bdcac36` 删除） | `src-tauri/target/release/nsis/x64/installer.nsi:45,47` | 配 `bundle.windows.nsis.headerImage`（150×57 BMP）与 `sidebarImage`（164×314 BMP），用 dBound 图标/配色；删除或归档过期截图 | 0.5d |
| I-06 | P2 | 品牌色 token 不一致：`make-icon.py:8-11` 的白色 `(249,249,245,236)`（alpha=236）、背景 `#1c1c20 → #0c0c0e` 与 `styles.css:4-9` 的 `#fafaf8 / #0c0d10` 不同源 | `scripts/make-icon.py:8-11` vs `src/styles.css:4-9` | 把图标配色集中到一个 `scripts/brand.py`（或 JSON），图标与 CSS token 同步生成 | 0.5d |
| I-07 | P2 | 三个 HTML 入口无 `favicon` / `theme-color`（开发态浏览器标签页显示空图标） | `index.html`、`mini.html`、`full.html` | 加 `<link rel="icon" href="/icon.png">` + `<meta name="theme-color">`（`public/` 放一份 32px） | 0.5h |
| I-08 | P2 | 安装包「属性 → 详细信息」公司名为空（portable 为 `Source X`），与应用内作者文案不一致 | `release/*.exe` PE 资源 | 配 `bundle.publisher`、`bundle.copyright`（已有）、`Cargo.toml` 元数据，统一为「Source X」 | 0.5h |
| I-09 | P2 | `icon.icns` + 11 个 `Square*Logo.png`/`StoreLogo.png` 在 `targets: ["nsis"]`、Windows-only 下无消费方（死重，易误导后续维护） | `src-tauri/icons/` | 二选一：删除未用资产并在 README 注明；或保留但加注释（若未来出 MSIX/商店版） | 0.5h |
| I-10 | P3 | README/仓库门面没有 logo 图；`scripts/nsis/installer.nsi` 是未被引用且已过期的上游模板副本（978 vs 实际生成 984 行，SHA 不同），容易改错地方 | `README.md`；`scripts/nsis/installer.nsi` | README 顶部加 64–96px logo；删除死模板文件或移动到 `docs/archive/` | 0.5h |

---

## 2. 版本号与发布元数据（用户点名 ②）

**核心矛盾：系统层版本 `1.0.1` 与展示层 `1.0.1 Beta2` 双轨。** 全仓 12 个入库文件共 **21 处**手写版本，零校验；「Beta2」不是合法 semver（Tauri 在构建期强制 semver 解析，写进 `tauri.conf.json` 会直接构建失败）——这正是被迫维护两套值的根因。同一 `1.0.1` 对应多个 Beta 构建时，Windows 应用列表、安装包文件名、`SHA256SUMS` 全部无法区分，NSIS 升级判定（`SemverCompare`）也会把 Beta 包当作同版本/降级。

| ID | 级别 | 问题 | 证据 | 修复建议 | 工作量 |
|---|---|---|---|---|---|
| V-01 | P0 | 版本双轨 + 21 处硬编码 | `tauri.conf.json:4`、`Cargo.toml:3`、`package.json:4`；展示层 `App.tsx:15`、`AboutPanel.tsx:3`、`ActivationPage.tsx:48`、`resources/版本信息.txt:3`、`README.md:5`、`GITHUB.md:4` | 见下方「单一来源方案」 | 1.5d |
| V-02 | P0 | `Beta2` 非法 semver；前端无任何取版本通道（`getVersion|package_info|CARGO_PKG` 命中 0） | `tauri-utils config.rs:3950-3971`；`tauri-codegen context.rs:255-260` | 版本=纯 semver；`Beta2` 移到 `package.json > dbound.channel`，展示层由 `__APP_VERSION__` + `__APP_CHANNEL__` 拼接 | 含 V-01 |
| V-03 | P1 | 仓库根无 `LICENSE`，三个 manifest 均无 `license` 字段（安装向导无许可页）；README 称源码 MIT，而 `resources/LICENSE.txt` 是限制性 EULA——三方不自洽；随包分发的 1595 个 Fluent Emoji（MIT）缺许可文本（`src/assets/fluent-emoji/LICENSE.txt` 未进 `bundle.resources`） | `README.md:179`；`resources/LICENSE.txt`；`tauri.conf.json:104-108` | 决策并统一：源码 MIT（放根 `LICENSE`）+ 安装包 EULA（改名 `EULA.txt` 避免混淆）；`bundle.resources` 加 `fluent-emoji/LICENSE.txt`；manifest 补 `license` 字段 | 0.5d |
| V-04 | P1 | `docs/PROGRESS.md:18-19` 交付物仍写 `dBound_0.1.0_x64-setup.exe（1.26 MiB）`，且同文件 `:158-163` 与 `:253-254` 关于 `/SERIAL`、`license.dat` 的记载自相矛盾 | 见左 | 交付物段落改为「见 release/ 最新产物」，历史变更只追加不覆盖；清理矛盾段落 | 0.5h |
| V-05 | P1 | `docs/GITHUB.md:6` 下载链接 `release/dBound_1.0.1_x64-setup.exe` 与 `:8` 的 `defaults-main.png`（现归档）按 docs/ 解析必 404（`release/` 在 `.gitignore:8`），且写死版本号 | 见左 | 改为 GitHub Releases 固定链接（`/releases/latest`）；图片改 `images/…`；版本号不写进正文 | 0.5h |
| V-06 | P2 | `publisher = "Source X"` 与 `Cargo.toml authors = ["dBound"]` 不一致；`使用说明.txt:9` 写「双击 dBound.exe」，实际主程序是 `dbound.exe` | `tauri.conf.json:109`；`Cargo.toml:5`；`resources/使用说明.txt:9` | 统一作者/公司名；文档改 `dbound.exe` | 0.5h |
| V-07 | P2 | 无 tag、无发布脚本；`src-tauri/target/release/bundle/nsis/` 残留 `dBound_0.1.0_x64-setup.exe`（1.27 MB）；`release/` 里有**未在任何文档记录的** `dBound-1.0.1-portable.exe`（18.36 MB） | 实测目录 | 打 `v1.0.1` tag；发布脚本清理旧包并断言「目录内只有一个安装包」；portable 要么写进 README（是卖点），要么不再产出 | 0.5d |
| V-08 | P2 | 3 个 verify 脚本硬编码「绝对路径 + 版本化文件名」（如 `release\dBound-1.0.1-portable.exe`），换版本即失效 | `scripts/verify-gpu.ps1:3` 等 | 改为参数化/通配最新产物 | 0.5h |
| V-09 | P3 | `SETTINGS_VERSION` 与 app 版本命名易混（设置迁移版本 vs 应用版本） | `settingsSchema.ts:18` | 重命名 `SETTINGS_SCHEMA_VERSION` 并注释 | 0.2h |
| V-10 | P3 | `copyright = 2026` 与今日一致 ✅、`SHA256SUMS.txt` 两条哈希与实物校验通过 ✅（无需改，仅记录） | — | — | — |

### 版本单一来源方案（推荐，可直接落地）

以 `src-tauri/tauri.conf.json > version` 为**唯一事实源**（它同时决定安装包名、注册表 DisplayVersion、PE 版本资源）：

1. `scripts/version.mjs`
   - `node scripts/version.mjs set 1.0.2 --channel Beta3`：写 `tauri.conf.json`、`package.json`、`Cargo.toml`、`resources/版本信息.txt`（模板渲染）。
   - `node scripts/version.mjs check`：全仓校验 6 处一致 + semver 合法 + channel 不出现于 semver，漂移则退出码 1 并打印文件:行。
2. `vite.config.ts`：`define: { __APP_VERSION__: JSON.stringify(conf.version), __APP_CHANNEL__: JSON.stringify(channel) }`，删除 `App.tsx:15`、`AboutPanel.tsx:3`、`ActivationPage.tsx:48` 三处字面量；展示统一为 `` `${__APP_VERSION__}${__APP_CHANNEL__ ? ' ' + __APP_CHANNEL__ : ''}` ``（或 `v1.0.2 Beta3`）。
3. `package.json`：`"ver:check": "node scripts/version.mjs check"`，`build` 前置 `ver:check`（`tauri build` 会调用 `beforeBuildCommand: pnpm build`，天然卡住）。
4. `resources/版本信息.txt` 由脚本生成，不再手改；README / GITHUB 正文不写死版本。
5. **下一发布号建议 `1.0.2`**（不要用 `1.0.1-beta.2`：NSIS 会按降级处理，且当前配置无 `allowDowngrades`）。

该方案已在仓库副本实测：漂移时退出码 1 并定位到文件；`set 1.0.2 --channel Beta3` 全部写入；修好后退出码 0。

---

## 3. 设置项体系（用户点名 ③）

现状：7 个面板（模式 / 级别 / 校准 / 全屏 / 设备 / 系统 / 关于），**35 个持久化字段 + 4 个复合项**，localStorage key `dbound.settings`，`SETTINGS_VERSION=2`，`sanitizeSettings` 做字段清洗——结构本身不错。问题集中在**迁移会丢数据、默认值多处抄写、跨窗口状态缺口、恢复默认不彻底、可用性**。

| ID | 级别 | 问题 | 证据 | 修复建议 | 工作量 |
|---|---|---|---|---|---|
| S-01 | P0 | **版本升级丢弃全部配置**：`migrateSettings` 在 `version < SETTINGS_VERSION` 时直接 `return defaultSettings()`，zustand 随后回写覆盖原数据；全仓无导出/备份入口 → 下一次升版本 = 全班自定义级别/标题/主题清零且不可恢复 | `settingsSchema.ts:434-437`；`stores/settings.ts:284-325`（唯一 key） | 写真正的迁移链（v2→v3）；迁移前把旧 payload 备份到 `dbound.settings.backup.<version>`；新增「导出/导入配置」JSON（含 version + channel）；升级检测到丢弃时 Toast 提示并提供恢复 | 1.5d |
| S-02 | P1 | **同版本读盘不清洗**：persist 未配 `merge`，zustand 只在 version 不等时才 migrate；`levels` 损坏/缺失会白屏（`LevelsPanel.tsx:173,188`、`MainPage.tsx:56`） | `stores/settings.ts:284-325`；`node_modules/zustand/middleware.js:399-415` | 增加 `merge: (persisted, current) => ({ ...current, ...sanitizeSettings(persisted) })`；级别数组做「非空 + 阈值有限 + 颜色合法」兜底；补一个「设置损坏自愈」单测 | 0.5d |
| S-03 | P1 | **跨窗口断流**：全屏/迷你只消费 `dbound:mini-state` 事件；该事件仅在测量中每 100ms 或切模式/状态变化时发；全屏无 `ready` 握手 → 暂停态进全屏显示 `INITIAL` 里的假值（`title:'dBound'`、`20px`、`600/1000ms`、`theme:'aurora'`、`idleText:'音量正常'`），与用户设置不符 | `miniBridge.ts:6,60-64`；`useLevelMonitor.ts:226-229,327-347`；`FullPage.tsx:60-91`；`MiniPage.tsx:6-37` | 迷你/全屏挂载时 `emit('dbound:state-request')`，主窗收到即回推一帧（含暂停态）；两窗 `INITIAL` 改为从 `settingsSchema` 的默认值生成或直接移除（首帧显示空白/上次缓存）；事件名改为通用 `dbound:state` | 1d |
| S-04 | P1 | **恢复默认有洞**：`resetAll` 靠三份手抄字段清单（初始 state / `resetAll` / `partialize`），新增字段易漏；会一并清空 `recordingDir`（用户配置的证据目录）与 `deviceId`，但提示未说明；无成功 Toast；全屏面板的「恢复默认」只重置标题/副标题（文案有歧义） | `stores/settings.ts:130-165,243-282,288-324`；`SystemPanel.tsx:287-313`；`FullscreenPanel.tsx:243-257` | 用 `defaultSettings()` 反射生成（`{...defaultSettings()}` 一次性 set），只在 `partialize` 维护一份白名单；恢复默认保留机器相关项（deviceId/cameraId/recordingDir）或二次确认「同时清除设备与保存目录」；按钮文案改「恢复本页默认」/「恢复全部默认」 | 0.5d |
| S-05 | P1 | **设备页在暂停状态点选设备会直接启动麦克风**：与页面自身提示「下次启动生效」相反，且用户可能只想改配置 | `DevicesPanel.tsx:54-57` → `useLevelMonitor.ts:314-324` | 仅在 `running` 时热切换；暂停时只写设置并提示「下次开始测量生效」 | 0.5h |
| S-06 | P1 | **`statusSize` 默认 32 但主窗被钳到 24**：面板提示「主界面与全屏共用」，实际主窗未命中时 `Math.min(24, statusSize)`，用户调 24 以上在主窗看不到变化；与 README「状态文字字号 32px」冲突 | `Gauge.tsx:129`；`settingsSchema.ts:109`；`README.md:42` | 去掉主窗钳制（布局按 32px 预留空间），或面板注明「主窗上限 24px / 全屏生效」并给出行内提示；统一 README | 0.5h |
| S-07 | P1 | **默认值多份抄写**：`MiniPage/FullPage` 的 `INITIAL`、README 的「600ms/1s」、`settingsSchema` 的 900/1200 三处不一致；主题、状态字号等也存在多处硬编码 | `MiniPage.tsx:6-37`；`FullPage.tsx:60-91`；`README.md:18` | 单一默认值来源（`settingsSchema`），窗口 `INITIAL` 由它派生；文档默认值改为「见设置页」或生成 | 0.5d |
| S-08 | P1 | 跨窗口**设置写冲突**：主窗与全屏各自渲染 React 副本，设置改动靠事件流单向下发；一旦全屏未来需要写设置（如快捷键调字号）就会覆盖主窗 | 架构 | 明确「主窗是唯一写者，副窗只读」并写入注释/文档；或抽 `settingsChannel` 统一广播 | 0.5d |
| S-09 | P2 | 校验静默截断：级别名 `slice(0,8)`、提示 `slice(0,30)`、阈值 `Math.round(x*2)/2`，超长/非法输入无提示；级别重名无检测；阈值允许乱序（虽不影响判定，但 UI 展示顺序按数组） | `settingsSchema.ts:213-231,257-267` | 输入框加 `maxLength` 与字数计数；保存时内联提示；提供「按阈值排序」按钮 | 0.5d |
| S-10 | P2 | 可用性/无障碍：滑杆无 `<label>`/`aria-valuetext`；设置 tab 无 `role=tablist/tab`、`aria-selected`；Toast 无 `aria-live`；`ink-faint`（`#a1a1a8` on `#fafaf8`）对比度约 **2.4:1**（低于 AA 4.5:1），而说明文字大量使用 9.5–10.5px | `ValueSlider.tsx:22-42`；`SettingsPage.tsx:50-70`；`Toast.tsx:17-25`；`styles.css:9` | 滑杆补 label + `aria-valuetext`（带单位）；tab 语义化 + 方向键；Toast `role="status"`；说明文字改 `ink-soft` 或加深 `ink-faint` 到 ≥4.5:1 | 1d |
| S-11 | P2 | IA 不合理：「系统」面板里放的是「外观主题 + 证据与录制 + 重置」，而「设备」面板里又有摄像头；真正的系统集成项（自启/快捷键/更新/单实例）反而不存在 | `SystemPanel.tsx`；`SettingsPage.tsx` | 拆为「外观」「证据」「系统」三页（或「外观」并入模式页顶部）；设备页只放输入/摄像头设备 | 1d |
| S-12 | P2 | 危险操作确认弱：「恢复默认」是双击确认 + `onBlur` 复位（可接受），但「清空日志」等跨页操作无统一确认组件；设置页无「打开日志/证据目录」入口，用户找不到文件 | `SystemPanel.tsx:292-311`；`LogsPage.tsx` | 抽 `<ConfirmButton>`；系统/证据卡片加「打开目录」（需 `opener` 插件或 Rust 命令） | 0.5d |
| S-13 | P2 | 缺失设置项（按价值排序）见下表 | — | — | — |

### 3.1 缺失设置项建议（按价值/成本排序）

| 建议 | 价值 | 成本 | 级别 | 说明 |
|---|---|---|---|---|
| **单实例保护** | 高（防双开双采集/双托盘/日志交错） | XS（半小时） | P1 | `tauri-plugin-single-instance` + 回调 `focus_main`；也可放到「系统」页显示状态 |
| **托盘菜单加「暂停/继续」** | 高（老师站讲台时不必回主窗） | S | P1 | `lib.rs` 托盘菜单增项 + 状态事件；PRD FR-6/FR-9 已要求 |
| **开机自启（默认关）** | 高（课堂机每天开机即用） | S | P1 | `tauri-plugin-autostart`，系统页 Toggle；PRD FR-9 已要求 |
| 全局快捷键（暂停/切全屏） | 中 | S | P2 | `tauri-plugin-global-shortcut`；注意与 F11 冲突处理 |
| 导出/导入配置 | 高（与 S-01 配套，换机/备份） | S | P1 | JSON 文件 + 版本号 + 导入前校验 |
| 设置页内「清空日志/打开目录」 | 中 | S | P2 | 现需进日志页，路径不可见 |
| 主题跟随系统 | 中 | S | P2 | 现有 `darkMode` 布尔，扩为 `system/light/dark` 三态 |
| 检查更新 | 中 | M | P2 | 先做「打开 release 页」，后续再上 `tauri-plugin-updater` + 签名 |
| 中英切换 / 提示音 | 低 | M | 不做 | 目标用户为中文课堂；仅视觉提醒是产品定位（PRD 明确非目标） |

---

## 4. 发布级工程与安全

| ID | 级别 | 问题 | 证据 | 修复建议 | 工作量 |
|---|---|---|---|---|---|
| E-01 | P0 | 激活码明文硬编码 + 文档公开 + 标记校验形同虚设：`const SERIAL="142857"`；`read_marker()` 只判断注册表值非空 → `reg add HKCU\Software\dBound /v License /d x` 即永久激活 | `license.rs:7,16-22`；`README.md:85`；`resources/使用说明.txt:11`；`GITHUB.md:73`（还说「请勿公开传播」，自相矛盾） | 先做产品决策（见 §8）：①接受「软门槛」定位 → 删除文档明文、改校验（至少校验固定值）、文案不再声称防破解；②真授权 → Ed25519 离线签名序列号（Rust 内置公钥、`verify_strict`、可选 `MachineGuid` 绑定），启动验签 | ①0.5d / ②2.5d |
| E-02 | P0 | 无 CSP + 三窗口 `--use-fake-ui-for-media-stream`（静默放行麦克风/摄像头）+ 无导航白名单 + `log_export`/`save_evidence` 任意路径写（`filename=".."` 可逃逸父目录、`data` 无上限） | `tauri.conf.json:71-73,28,45,64`；`logs.rs:174-176`；`evidence.rs:24-54` | ①`security.csp` + `devCsp` + `freezePrototype`（engineering.md §4.1 有可粘贴值）；②`on_navigation` 白名单（仅 tauri/ipc/localhost:1420）；③`save_evidence` 用 `file_name()` 归一化、拒绝 `..`、后缀白名单、8MB 上限；`log_export` 限定用户经 `dialog.save()` 选过的路径；④至少去掉无收益的 `msSmartScreenProtection`；⑤三处 `additionalBrowserArgs` 提为共享常量 | 1.5d |
| E-03 | P0 | 发布不可追溯：无签名（SmartScreen 报未知发布者）、无 CI、无 tag；构建目录残留 0.1.0 旧包；`release/` 产物与 commit 无关联记录 | 无 `signCommand`；无 `.github/`；`git tag` 空 | 配 `bundle.windows.signCommand`（证书/密钥只进 CI secrets）；GitHub Actions：`ver:check` → typecheck/test → `tauri build` → 产物+`SHA256SUMS.txt` 上传 Release；打 `v*` tag 并断言与 conf 版本一致；发布前清理旧包 | 1.5d |
| E-04 | P0 | 离线部署被阻断：`downloadBootstrapper` 安装时必须联网 | `tauri.conf.json:99-102` | 教室场景出 `offlineInstaller` 离线包（约 +130MB，单独 artifact），或 `embedBootstrapper` + 安装前置说明；`hooks.nsh` 预检 WebView2 注册表并给中文提示 | 0.5–1d |
| E-05 | P1 | MSRV 声明与现实冲突：`rust-version="1.77.2"`、README「Rust 1.77+」，而 tauri 2.12.5 要求 **1.90**（本机 1.97 所以没暴露） | `Cargo.toml:7`；`README.md:61`；`tauri-2.12.5/Cargo.toml` | 改 `rust-version="1.90"`、`edition="2024"`、加 `rust-toolchain.toml`，README 同步 | 0.5h |
| E-06 | P1 | 无 lint/format/CI 门禁；无 `.editorconfig`；`tauri.conf.json:94-96` 已有缩进错乱 | `package.json:7-14`；`node_modules` 无 eslint/prettier/biome | 上 Biome（一个工具替代 eslint+prettier）+ `"lint"/"format"/"check"` 脚本；Rust `cargo fmt --check` + `clippy -D warnings`；CI 必过 | 0.5d |
| E-07 | P1 | capabilities 过宽：17 条中 6 条被默认集覆盖（冗余）、6 条前端从未调用、`dialog:default` 下放迷你/全屏 | `capabilities/default.json:5-24`；`acl-manifests.json` 实测 | 拆 `main/mini/full` 三个 capability，17 → 约 8 条；删 `lib/tauri.ts` 死代码 `startDragging/hideWindow` | 0.5d |
| E-08 | P1 | 0 个 Rust 测试，而最危险逻辑（授权/日志清理/证据路径清洗）全在 Rust | `src-tauri/src/*.rs` 无 `#[cfg(test)]` | 为 `logs.rs prune/log_read`、`evidence.rs sanitized`、`license.rs` 加 `#[cfg(test)]` + `tempfile`；前端补 `@vitest/coverage-v8` 与阈值 | 1.5d |
| E-09 | P1 | 证据写盘走 `number[]` IPC：15s/16kHz WAV ≈ 480,000 字节 → JSON 约 1.5–2.9MB 字符串，警报瞬间叠加全屏动画可能卡顿 | `src/lib/evidence.ts:24`；`evidence.rs:24-29` | 改 base64 字符串（最省事）或 Tauri raw IPC（`tauri::ipc::Request`）；加大小上限与失败重试 | 0.5d |
| E-10 | P1 | `panic="abort"` 且无崩溃记录；唯一 `expect` 在 `lib.rs:64` | `Cargo.toml:28`；`lib.rs:64` | 注册 `std::panic::set_hook` 写 `app_data_dir/crash/*.log`（abort 前会执行）；`expect` 换成日志+错误弹窗 | 0.5d |
| E-11 | P1 | 无单实例（同 §3.1）；用户双击两次 = 双进程双托盘双麦克风 | 无 `tauri-plugin-single-instance` | 加插件并作为第一个 plugin 注册，回调 `focus_main` | 0.5h |
| E-12 | P1 | 安装包 16.18MB 中 14.70MB 是 1602 张 96px emoji PNG（均 9.2KB，96px 合理值 2–3KB） | `dist` 实测；PROGRESS 记录 13.5MB | 构建前用 `sharp` 转 WebP（产物不入库，PNG 原件保留），预计安装包降到 **~6MB**；两套 emoji 目录有 34 张内容重复可去重 | 0.5d |
| E-13 | P2 | `styles-*.js` 218KB 是 react-dom，mini 也全量加载；`RollingNumber-*.js` 277KB（gzip 134KB）是 emoji URL 映射 eager 打包 | 体积实测 | **建议不为此大改**（本地加载，134KB gzip 影响毫秒级）；仅当启动实测 >300ms 再做动态 import | — |
| E-14 | P2 | 27 个 `verify-*.ps1` 用绝对路径、仍断言已删除的 `license.dat`（假绿），无图标/版本/设置迁移校验 | `scripts/verify-*.ps1` | 收敛为 `scripts/verify/` 下参数化脚本；删改过期断言；新增 icons/version/settings-migration 三项 | 1d |
| E-15 | P2 | 仓库门面/规范缺位：无 `.gitattributes`（换行/编码）、无根 LICENSE、无 CHANGELOG；`scripts/nsis/installer.nsi` 是死文件 | — | 一次性补齐仓库门面 | 0.5d |

---

## 5. 文档与需求一致性（交叉复核，我方补充）

| ID | 级别 | 问题 | 证据 | 修复建议 |
|---|---|---|---|---|
| D-01 | P1 | **文档截图失准**：`docs/images/archive/defaults-main.png`（原 `GITHUB.md` 首图）里大数字明显呈碎片/重影——滚筒动画中途截帧；`docs/images/archive/activated-main.png` 顶部有漂浮弧线（呼吸环动画中途）。默认 900ms 滚动 / 1200ms 刷新意味着约 75% 时间数字处于滚动中间态，截图脚本若不等待落定就会抓到这种画面 | `docs/images/archive/defaults-main.png`、`docs/images/archive/activated-main.png`；`settingsSchema.ts:49-53` | 截图脚本等待动画落定（或临时 `readoutAnimation=false`）再抓；同时评估默认 `rollingMs` 降到 450–600ms，让数字更快稳定可读 |
| D-02 | P1 | README 默认值描述过期：「600ms 滚动 / 1s 刷新」vs 代码 900/1200；「级别文字 24px」「状态文字 32px」与主窗 24px 钳制冲突 | `README.md:18,42`；`settingsSchema.ts:49-53,109`；`Gauge.tsx:129` | 默认值改为引用或由脚本生成；与 S-06 一起修 |
| D-03 | P1 | `docs/PRD.md` 仍是 v0.3，与实现大面积不符：3 级预设（实际各 1 级）、`tauri-plugin-store`（实际 localStorage）、偏移 ±30（实际 65–125）、`com.dbound.app` 日志路径（实际 `com.dbound.desktop`）、级别拖拽排序（未实现）、迷你窗 120×44/右键菜单/透明度（实际 158×58、仅点击回主窗、无透明度）、开机自启/快捷键/单实例（未实现） | `docs/PRD.md:15-20,108-114,122,150,168,176-178` | PRD 升 v1.0：把「已实现/已变更/已放弃」逐条标注；或拆成 `PRD.md`（当前需求）+ `HISTORY.md`（早期设计） |
| D-04 | P1 | PROGRESS 过期/矛盾：交付物写 0.1.0；「设置页五段」实为七段；emoji 段落先写 20 个、后写 1595 个、再写 40 个，读者无法判断当前状态 | `docs/PROGRESS.md:18-19,33`、emoji 段 | 顶部加「当前状态摘要」（版本/产物/关键配置）并随发版更新；历史段落不改 |
| D-05 | P2 | `docs/GITHUB.md` 与 README 内容重复且互相矛盾（激活码公开 vs 勿传播；「三种时间加权」实际只有「朗读平滑」开关） | `GITHUB.md:6,8,15,73` | 合并为单一 README，GITHUB.md 删除或只留仓库描述 |
| D-06 | P2 | `docs/images/` 24 张共 **18.34MB**（单张最大 4.22MB），其中仅 9 张被 README 引用（另 1 张被 `GITHUB.md` 引用）；含已删除的安装序列号页截图（`installer-serial.png`） | `docs/images/` | 压缩为 WebP/JPEG（预计 <2MB）、删除过期截图、未被引用的归档到 `docs/images/archive/` |
| D-07 | P2 | 产品承诺与实现不符：PRD 承诺「麦克风隐私关闭时一键打开 `ms-settings:privacy-microphone`」，代码中无该深链（全仓 `ms-settings` 命中 0） | `docs/PRD.md:183`；`src/` | 补 Rust 命令 `open_url("ms-settings:privacy-microphone")` 并接到麦克风错误态提示 |
| D-08 | P2 | PRD「托盘图标 = 当前状态」未实现（托盘图标固定为应用图标） | `lib.rs:158-195` | 与 I-01 一起做：空闲/测量/暂停三态托盘图标（或角标），成本低、辨识度高 |

---

## 6. 建议交付批次

| 批次 | 内容 | 工作量 | 验收标准 |
|---|---|---|---|
| **Batch 1（本周，用户点名项）** | V-01/V-02 版本单一来源 + semver；I-01/I-02/I-03 托盘图标 + 应用内 brand mark + icon 脚本；S-01/S-02 设置迁移与清洗；S-03 跨窗口首帧；S-04 恢复默认；S-05/S-06 小修；D-01/D-02 文档与截图 | ≈ 6–8 人日 | `ver:check` 全绿；托盘在深色任务栏 16px 可辨；升级安装后旧配置保留；暂停态进全屏显示正确标题/字号；截图无碎片 |
| **Batch 2（发布前必须）** | E-01 授权决策+落地；E-02 CSP/导航/IPC；E-03 签名+CI+tag；E-04 离线包；E-05/E-06 MSRV+lint；E-07 capabilities；E-11 单实例；V-03/V-04/V-05 许可证与文档 | ≈ 6–8 人日 + 证书申请 | 干净 Win10 离线机可装可跑；SmartScreen 无「未知发布者」；Release 页面产物与 tag 对应；`cargo clippy`/`biome check` 通过 |
| **Batch 3（体验与余量）** | E-08 Rust 测试；E-09 IPC；E-10 panic hook；E-12 emoji WebP；S-09/S-10/S-11/S-12；D-03/D-04/D-05/D-06/D-07/D-08；E-14/E-15 | ≈ 8–10 人日 | 安装包 ≤8MB；设置页按新 IA 可达；无障碍基础项通过；旧 verify 脚本全部可跑 |
| **Batch 4（可选）** | 托盘暂停、开机自启、导出/导入、检查更新、主题跟随系统、全局快捷键 | 按需 | 逐项验收 |

> 建议顺序理由：Batch 1 改动面小、用户可感知、且为后续所有版本发布提供「版本可校验」的地基；Batch 2 决定能否对外分发；Batch 3 是质量余量。

---

## 7. 不建议做的事（避免过度优化）

- **不要**为 277KB 的 emoji 映射 chunk 大改架构（本地加载，gzip 134KB，收益毫秒级）。
- **不要**给 mini/full 拆 vendor chunk（本地应用无 HTTP 缓存收益，反而增加请求数）。
- **不要**上 i18n / 提示音：目标用户中文课堂，且「仅视觉提醒」是产品定位（PRD 非目标）。
- **不要**为跨平台保留 icns/Store logo 的构建负担（Windows-only 明确定位）——删除或注释即可。
- **不要**在未签名、无 CI 的情况下继续手工发版（会持续制造「用户装的是哪个包」的不可追溯问题）。

---

## 8. 待确认决策（需要作者拍板）

1. **授权定位**：接受「软门槛（防误用而非防破解）」→ 删文档明文 + 修校验；还是要真授权（Ed25519 签名 + 机器绑定）？影响 E-01 的 0.5d vs 2.5d。
2. **Beta 渠道策略**：`Beta2` 是否继续对外？建议：正式版用纯 semver（1.0.2），Beta 通过 `channel` 字段展示，不进入安装包版本。
3. **离线包**：教室机器是否普遍无外网？决定 E-04 走 `offlineInstaller` 还是 `embedBootstrapper`。
4. **设置迁移**：旧版本配置是否值得保留（当前直接丢弃）？建议至少备份 + 导入导出。
5. **portable 版**：`dBound-1.0.1-portable.exe` 是否作为正式产物（写进 README）还是仅供自测？
6. **默认滚动时长**：900ms 滚动 / 1200ms 刷新是否过长（截图碎片、读数滞后）？建议实测课堂观感后定 450–600ms。
7. **发布渠道**：GitHub Releases / 自有站点 / 网盘？决定 CI 与文档链接写法。

---

## 9. 复现与验证命令（只读）

```powershell
# 版本一致性（人工版，脚本落地前）
Select-String -Path package.json,src-tauri\tauri.conf.json,src-tauri\Cargo.toml -Pattern '"version"|^version'

# 图标/构建产物核对
Get-ChildItem src-tauri\icons | Select-Object Name,Length
git ls-files | Measure-Object                      # 1796 个文件 / 34MB

# 设置/窗口相关代码定位
Get-ChildItem -Recurse src -Include *.ts,*.tsx | Select-String -Pattern 'APP_VERSION|INITIAL|resetAll|migrateSettings'
```

---

## 附录：分报告索引

| 分报告 | 内容 | 项数 |
|---|---|---|
| `output/analysis/icons.md` | 图标链路全清单、17 文件 SHA-256、ICO/ICNS 结构、16px ASCII 证据、生成/校验流程 | 12 |
| `output/analysis/version.md` | Tauri 2 版本机制源码级核实、21 处版本清点、单一来源实现（含脚本实测）、发布 checklist | 14 |
| `output/analysis/settings.md` | 39 行设置项全量清点表（默认值/范围/持久化/生效窗口）、22 条缺陷、缺失项优先级、IA 与文案建议 | 22 |
| `output/analysis/engineering.md` | 量化数据（体积/依赖/仓库）、31 条工程与安全问题、CSP/导航/权限可粘贴方案、发布流水线 | 31 |

> 审计过程未修改任何既有源码、配置、图标或依赖（`git status` 仅显示本次新增的 `docs/OPTIMIZATION.md`；四份详细分报告位于 `output/analysis/`，该目录被 `.gitignore` 忽略）。
