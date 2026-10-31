# 来源、版本差异与未验证项

**别全信这份技能，也别全信任何单一来源。** 下面是取证过程，方便你在结论可疑时自己复核。

## 本次取证环境

| 项 | 值 |
|---|---|
| 本机运行时 | `dsh --version` = **0.2.1-rc.2**（2026-10 采样；npm `next` 通道。同一时刻 `latest` 仍是 `0.2.0-rc.2`，`alpha` 是 `0.2.1-alpha.5`） |
| 全局安装位置 | `~/.npm-global/lib/node_modules/@deepseek-ai/dsh`，子包在 `dsh/node_modules/@deepseek-ai/*`（**305** 个；0.2.0-rc.2 时是 288 个） |
| vendored cordis | **4.0.5**（0.2.0-rc.2 时是 4.0.4） |
| 官方仓库快照 | 精确 tag **`dsh-v0.2.1-rc.2`**（`git fetch --depth 1 origin refs/tags/dsh-v0.2.1-rc.2`），解包在 `/tmp/dsh-021rc2`；对照用的旧 tag `dsh-v0.2.0-rc.2`。**看文档必须对 tag，不要看 master** |
| Node / pnpm | `node v24.21.0`、`pnpm 12.11.2` |
| 第三方参考 | npm `dsh-plugin-guide@0.3.33`（PerryLink，知识库型插件 + agent 技能）；GitHub `lxj5820/dsh-boot-animation`；`dsh-dream-skin@10.15.0`（web profile 已装） |

## 一手材料（优先级从高到低）

1. **本机安装产物**（最权威）：`@deepseek-ai/dsh-package-manifest/lib/types/types.d.ts`、`dsh-app-boot/lib/index.js`（兼容门、展示元数据、层序）、`dsh-client-modules`、`dsh-skill` / `dsh-skill-filesystem` / `dsh-tool-skill`、`dsh-web-app/presets/cordis.patch.yml`。
2. **官方仓库对应 tag 的文档**：`docs/upgrade-guide/<版本>/**`（**破坏性变更的唯一权威说明**）、`docs/user/develop/{basic,framework,practice}`、`docs/cookbook/adding-a-package.md`、`packages/boot/app-boot/README.md`、`apps/cli/reference/README.md`。
3. **官方随包技能**：`@deepseek-ai/dsh-agent-preset/skills/cordis-plugin-development/**`、`cordis-composition-reference`、`editing-cordis-compositions`。**它假定调用方有 `plugin_manager` / `cordis_inspect_query` 工具**，普通会话没有，所以本技能额外给了纯 CLI 路径。
4. **第三方**：`dsh-plugin-guide` 的 `SKILL.md`/`guide/*`；`dsh-boot-animation` 的源码注释。**第三方文档最容易随版本从正确变错误**，只当线索。

## 版本差异对照（同一句话在新旧版本含义不同）

| 主题 | 0.2.0-rc.2 | **0.2.1-rc.2（本机，已实测）** |
|---|---|---|
| `engines.dsh` | 纯声明，安装/启动都**不**检查；兼容性只看 `@deepseek-ai/dsh*` peer | **强制**：安装与 profile 启动都检查，且**声明了它就单独决定**、peer 被忽略；没有才回退 peer。失败键名从 `peers` 改成 `requirements`。见 `docs/upgrade-guide/v0.2.1-alpha.3/plugin-engines-dsh/` |
| 插件图标 | 只认顶层 `package.json.icon` | **顶层 `icon` 与 `exports["./icon"]` 都支持**，顶层优先（`iconOf()`：有 manifest icon 就不再看导出） |
| 子路径插件展示清单 | **仍读** `<subpath>/package.json` | **一律不读**；文案走 `<subpath>/locale/*.json`，图标只认 `<subpath>/icon` |
| `dsh plugin` 参数位置 | `--profile` 可出现在任意位置；`--help` 转发给 pnpm | **`--profile` 只能在转发参数之前**；`dsh plugin --help` 打自己的帮助；相对路径锚定调用目录。见 `upgrade-guide/v0.2.1-alpha.1/plugin-option-placement/` |
| CLI 诊断开关 | `--dump-config` | 另有 **`--dump-config-schema`**（行/补丁的 JSON Schema）与 **`--dump-default-config`**（去掉用户层与 `--patch` 的骨架） |
| 官方模板/技能 | `decoration/` 只有 4 个文件 | 多了 `icon.svg`、`locale/en.json` 与"展示元数据 checklist" |
| 内置 bundle 预览图 | 无此概念 | 新增 `docs/cookbook/adding-a-plugin-preview.md`，但**明确不给第三方**：包无法声明预览图 |
| 必修包 | —— | `web-runtime` 进入必需条目列表（`app-boot` README） |

**由此得到的一条硬教训**：第三方 `dsh-plugin-guide` 里"交付必须导出 `./icon`"这条，在 0.2.0-rc.2 上**不成立**，到 0.2.1-rc.2 又**成立**了；而 `engines.dsh` 反过来从"不影响"变成"最重要的一条"。**验收标准永远是本机 `dsh --version` 对应的那份源码，不是任何文档，包括这份。**

## 本机实测清单（0.2.1-rc.2，可复现）

| 验证项 | 做法 | 结果 |
|---|---|---|
| 插件真能加载 | `dsh --profile web --patch <overlay.yml> --help`（overlay 的 `name` 用绝对路径） | `apply` 执行、`config` 传入、`ctx.effect` 注册**与释放**都打印 |
| `engines.dsh` 优先于 peer | A：无 `engines.dsh` + peer `>99.0.0` → **拒绝**，`requirements {"@deepseek-ai/dsh":">99.0.0"}`；B：`engines.dsh ">=0.2.0 <0.3.0"` + 同样的坏 peer → **安装成功** | 两组都实跑，B 的包进入 `dsh.profile.bundles`。**engines 单独决定，实测确认** |
| bundle 自动入栈 | `dsh plugin --profile <新> add <带 dsh.bundle.patch 的目录>` | 自动追加进 `dsh.profile.bundles`；不带 bundle 声明则打警告 `declares no dsh.bundle — installed as a plain dependency, not a profile layer` |
| `link:` 安装 | 同上，看 profile 的 `package.json` | 依赖写成 `"<包名>": "link:/abs/path"`（**0.2.0 时代未验证，这次直接确认**），35–64 ms 完成 |
| 安装失败诊断 | 故意用不兼容 engines 的包 | 拒绝文案 + `dsh: nothing was installed.` + `allow-version ... --accept-risk` 提示 + `plugin command failed; diagnostics: .../logs/operation-*/pnpm.log` |
| `ctx.` 未声明服务 | 插件里读 `ctx.notAService` | 抛错，后续输出全部消失（有无日志取决于 Loader 日志级别） |
| `ctx.get` 语义 | 无 `inject` / 有 `inject: ['tools']` 各一次 | 无 inject 时 `ctx.get('tools')` 为 `undefined`，有 inject 时为真值；但 `ctx.get` 源码注释写明 *without the inject requirement* —— 见"尚未验证" |
| 陈旧 override | patch 覆盖不存在的 id | `patch: entry "no-such-row-xyz" not found`，**只在 `--dump-config` 输出**，`--help` 下不出现 |
| 客户端组合确实执行 | 插一个 `inject: ['clientModules']` 的探针跑 `--help` | 打印 `activated = true`；而坏 `dsh.client`（platform 非法 / 无 `./client` 导出）**零诊断**（stdout 32 行、stderr 仅代理警告）→ 失败被降级到 `ctx.logger.warn` |
| slot 清单 | 两处 grep（in-box + profile） | **100** 个唯一 slot（0.2.0-rc.2 时 90 个）；文中列的 9 个全部仍在 |
| skill 格式 | 读 `dsh-skill` + `dsh-skill-filesystem` | 与 0.2.0-rc.2 一致：`SKILL_NAME` 正则在 `dsh-skill/lib/index.js:17`，rank 表 100/200/300/400/500/600 未变，`catalogDescriptionMaxLength` 默认 500，`collectCacheMaxEntries` 128 |

## 尚未验证 / 我保持怀疑的部分

- **UI 半边的真实渲染**：没有浏览器控制，只能做语法、manifest、slot 层级检查。
- **`defineTool` 的端到端调用**：只核对了导出与参数校验（`dsh-tools`），没有实跑一次工具调用。
- **`.volatile()` 实时设置**：只读了第三方插件注释与官方文档，没有实测设置页联动。
- **MCP bundle、agent preset 编辑、HMR 热替换行为**：未实测。
- **`ctx.get` 的读法**：`get(name, strict = true)` 源码注释写明 *without the inject requirement*，`strict` 只要求提供方 fiber 已 `ACTIVE`。"未声明 inject 就读不到"的现象更可能是**读得太早**，但"何时算激活"没有完整实测。
- **`engines.dsh` 的 profile 启动侧**：安装侧 A/B 都实测了；"启动时对已装 bundle 复检"来自 `app-boot` README 与源码，**没有**构造一个装好后故意不兼容的 profile 去实跑。
- **in-box bundle 的 `add` 失败**：0.2.0-rc.2 上实测过（拿到过期 `0.0.1-rc.1` 被拒），**0.2.1-rc.2 没有重跑**；registry 状态可能已变。
- **`allowBuilds` 的版本归属**：dsh 侧确认会写进 `<profile>/pnpm-workspace.yaml` 的 `allowBuilds`；"pnpm ≥10 才有"这个版本归属没核对。
- **`cordis_inspect_query` 类 inspection 工具**：官方技能假定有，本会话没有；"普通 Web 会话是否一律缺失"未系统核对。
- **网络**：全程走代理，日志有 `all_proxy names a SOCKS proxy ... connecting directly`；安装类结论只在这套网络下成立。

## 审查与适配记录

**第一轮（0.2.0-rc.2 时代，两个独立子代理只读审查）**：修掉 3 条阻断级（客户端 `exports` 缺 `./package.json` 致展示元数据静默丢失；`ctx.skills.register()` 签名错；`registerProvider()` 应收工厂）与 11 条应修正。

**第二轮（同上）**：修掉 1 条阻断级（把**下一版**的子路径插件行为写成了本机行为）与 6 条应修正（slot 检索命令指向不存在的目录、客户端组合时机机制说反、`external` 缺失边过度断言、override 静默/大声自相矛盾、安装拒绝输出把 CLI 行当安装器原文、`SKILL_NAME` 出处写错）。

**第三轮（0.2.1-rc.2 适配）**：DSH 从 0.2.0-rc.2 升到 0.2.1-rc.2 后逐条重验，**主要变化都不是"文档改了"，而是"行为翻了"**：

- `engines.dsh` 从"纯声明"变成"强制且优先"，这一条直接推翻了旧版技能里"engines.dsh 是纯声明"的说法。用 A/B 两组安装实验确认了优先级，不是照抄升级指南。
- 子路径插件展示清单从"仍读 package.json"翻成"一律不读"——上一轮我正是因为**提前写了下一版行为**被判阻断级，这一轮它真的到了，于是反向改写。
- 图标从"只认顶层"变成"两种都支持"。
- `dsh plugin` 的 `--profile` 位置规则变化，旧写法会直接报错。

结论仍然是那句：**"外部来源不可全信"同样适用于我自己写的东西，也适用于我自己上一轮写的"已实测"。** 版本一升，昨天的实测就是今天的错误答案；这份文档里每个数字都绑着版本号，就是为了让下一个人知道该重验哪些。

## 0.2.1-rc.4 静态分析记录（未在本机运行）

- 基线：tag `dsh-v0.2.1-rc.4`；本机运行时仍为 0.2.1-rc.2，**未做运行时验证**。
- `docs/**` 与 rc.3 **零差异**；插件作者相关六个核心文件同样零差异。
- 变更集中在 MCP 客户端/资源、web 搜索与抓取工具、workspace/workflow 单点，以及大量 version 同步。
- 源码口径与 rc.3 相同：343 / 110 / 88 / 80。
- 详见 `../../STATUS.md`。
