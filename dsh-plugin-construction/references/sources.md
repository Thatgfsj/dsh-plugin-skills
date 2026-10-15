# 来源、版本差异与未验证项

**别全信这份技能，也别全信任何单一来源。** 下面是取证过程，方便你在结论可疑时自己复核。

## 本次取证环境

| 项 | 值 |
|---|---|
| 本机运行时 | `dsh --version` = **0.2.0-rc.2**（npm `latest`，当时全部 npm 版本都是 prerelease） |
| 全局安装位置 | `~/.npm-global/lib/node_modules/@deepseek-ai/dsh`，子包在 `dsh/node_modules/@deepseek-ai/*`（288 个） |
| 官方仓库快照 | `git clone --depth 1 https://github.com/deepseek-ai/deepseek-harness`，master = **0.2.1-alpha.4**（比本机新一版），克隆在 `AIagent/.scratch/dsh-src`（临时目录，可删可重取） |
| 第三方参考 | npm `dsh-plugin-guide@0.3.33`（PerryLink，知识库型插件 + agent 技能）；GitHub `lxj5820/dsh-boot-animation`；`dsh-dream-skin@10.15.0`（本机 web profile 已装） |

## 一手材料（优先级从高到低）

1. **本机安装产物**（最权威）：`@deepseek-ai/dsh-package-manifest/lib/types/types.d.ts`、`dsh-client-modules`、`dsh-skill-filesystem/lib/index.js`、`dsh-tool-skill/lib/index.js`、`dsh-mcp-client/lib/types/index.d.ts`、`dsh-web-app/cordis.patch.yml`、`dsh-base`。
2. **官方随包技能**：`@deepseek-ai/dsh-agent-preset/skills/cordis-plugin-development/**`（SKILL.md + 6 份 references + 2 套模板）、`cordis-composition-reference`、`editing-cordis-compositions`。这是"官方自己也当成技能"的那一份，但**它假定调用方有 `plugin_manager` / `cordis_inspect_query` 工具**，普通会话没有，所以本技能额外给了纯 CLI 路径。
3. **官方仓库文档**：`docs/user/develop/{basic,framework,practice}`、`docs/architecture.md`、`docs/cordis-primer.md`、`docs/defensive-patterns/*`、`packages/AGENTS.md`、`docs/postmortem/0001-acp-default-export-drops-inject.md`。
4. **第三方**：`dsh-plugin-guide` 的 `SKILL.md`/`guide/*`；`dsh-boot-animation` 的源码注释（对设置命名空间、`Config` 必须静态可解析等有很细的一手记录）。

## 版本差异对照（同一句话在新旧版本含义不同）

| 主题 | 本机 0.2.0-rc.2（已验证） | master 0.2.1-alpha.4 |
|---|---|---|
| 插件图标 | **顶层 `package.json.icon`**（`DshPackageManifest.icon`）；本机随包技能与真实第三方插件都这么写 | 可用 exports 里的 `"./icon"`；顶层 `icon` 仍优先 |
| 官方模板 | `decoration/` 只有 package.json / cordis.patch.yml / index.js / client.js | 多出 `icon.svg`、`locale/en.json` 与"展示元数据 checklist" |
| 官方技能正文 | 无"display checklist"一节 | 新增该节，并要求交付前核对图标与本地化标题 |
| 子路径插件展示清单 | **仍读** `<subpath>/package.json`（`readPluginMeta` 的 specifier 含子路径，过滤器只丢非包说明符） | **不再读**该清单，改用 locale `meta` + 导出 `<subpath>/icon`；官方有 `upgrade-guide/v0.2.0-rc.2/subpath-plugin-display-manifest/` 专文 |

**由此得到的一条硬教训**：第三方 `dsh-plugin-guide` 里"交付必须导出 `./icon`"这条，按它自己声明的目标版本（`0.2.1-alpha.2+`）没问题，但**照抄到本机 0.2.0-rc.2 不生效**。验收标准永远是本机 `dsh-package-manifest` 的类型与已装插件的实际写法，不是任何文档。

## 本机实测清单（可复现）

| 验证项 | 做法 | 结果 |
|---|---|---|
| 插件真能加载 | `dsh --profile web --patch <overlay.yml> --help`（overlay 里 `name` 是绝对路径） | `apply` 执行、`config` 传入、`ctx.effect` 注册与释放都打印 |
| `ctx.` 未声明服务 | 同上，插件里读 `ctx.notAService` | 抛错，**整行静默消失**（只打印到第一行） |
| `ctx.get` 语义 | 无 `inject` / 有 `inject: ['tools']` 各一次 | 无 inject 时 `ctx.get('tools')` 为 `undefined`；有 inject 时为真值 |
| 陈旧 override | patch 里覆盖不存在的 id | `patch: entry "no-such-row-xyz" not found`（大声） |
| link 安装 + 层 | `dsh plugin --profile <新建> add <目录>` | 40 ms 完成（base 从 dsh 安装解析，不下载）；`--dump-config` 出现 `# == <包名>` 层 |
| 依赖解析 | 插件 `import Schema from '@deepseek-ai/schemastery'`，先不声明 peer | `ERR_MODULE_NOT_FOUND`（node 直接 import 同样失败），插件不加载且无可见报错 |
| peer 解锁 | 把该包加进 `peerDependencies` 后重启 | 同一份代码立刻加载成功 |
| 安装期兼容门 | `dsh plugin add @deepseek-ai/dsh-web-app` | 从公共 registry 取到 `0.0.1-rc.1`，被拒并给出 `allow-version` 命令，`nothing was installed` |
| 客户端组合时机 | 把 `dsh.client.platform` 改为 `123`、把 `./client` 指向不存在文件后 `--help` | **都不报错**；但插入 `inject: ['clientModules']` 的消费者后同一条 `--help` 会打印它激活 → **组合确实执行了，错误被降级到 `ctx.logger.warn`**。我最初由此推出「组合在 start 阶段、`--help` 覆盖不到」，复审推翻了这个因果 |
| skill 格式 | 读 `dsh-skill/lib/index.js` + `dsh-skill-filesystem/lib/index.js` | `SKILL_NAME` 正则在 **`dsh-skill/lib/index.js`**（filesystem 侧经 `isSkillName` 调它）；缺 `name`/`description` 由 `dsh-skill-filesystem` 丢弃；`dsh-tool-skill` 目录描述默认上限 500 字符 |
| skill 被发现 | 把本技能写进 `~/.dsh/skills/` | 同一会话的技能目录立即出现该技能（watcher 生效） |

## 尚未验证 / 我保持怀疑的部分

- **UI 半边的真实渲染**：本机没有浏览器控制，只能做语法、manifest、slot 层级检查。`client.js` 只做了 `node --check` 语法校验和协议比对。
- **`defineTool` 的端到端调用**：我的验证插件因为上面的 import 解析问题没跑起来，工具注册**没有实测**，相关结论来自官方教程与类型定义。
- **`.volatile()` 实时设置**：只读了 `dsh-boot-animation` 的注释与官方文档，没有实测设置页联动。
- **MCP bundle、agent preset 编辑、HMR 热替换行为**：未实测，写法取自官方技能与 `cordis-composition-reference`。
- **`ctx.get` 的读法**：我最初只观测到"未声明 `inject` 时读不到 `tools`"并据此推成"它不是存在性探针"。复审读 cordis 源码后推翻了这个因果：`get(name, strict = true)` 源码注释写明 *without the inject requirement*，`strict` 只要求提供方 fiber 已 `ACTIVE`。所以更可能是**读取时机太早**。这条已按复审改写，但"何时算激活"仍没有完整实测。
- **Node/包管理器版本**：本机 `node v24.21.0`、`pnpm 12.11.2`；官方 engines 是 `^22.19 || >=24`。其他版本可能有别的行为。
- **网络**：本次全程走代理，日志里有 `all_proxy names a SOCKS proxy ... connecting directly` 的提示；安装类结论只在这套网络下成立。

## 审查记录（本轮）

这两份技能经过**两个独立子代理的只读审查**（一个查插件构建的事实断言，一个查技能格式与 API 语义），逐条给证据（文件+行号 / 命令+输出），并做了可复现探针。共修掉 **4 条阻断级 + 17 条应修正**，另一名审查员还把本文档"我已核实为真"的若干条重新跑了一遍（结论一致）。

**第一轮（技能格式与示例签名）**

- 阻断级 3 条：客户端最小示例的 `exports` 缺 `./package.json`/`./locale/*.json` 会导致图标与标题**静默丢失**；`ctx.skills.register()` 被误写成"第二参数传正文"（实际单参数且 `source`/`content` 必填）；`ctx.skills.registerProvider()` 被误写成收 provider 对象（实际收工厂）。
- 应修正 11 条：`engines.dsh` 的强制力表述自相矛盾；`ctx.get` 因果解释与 cordis 源码相反；"不声明 peer 就静默不加载"过度绝对；`dsh.client` 无 `./client` 抛错的条件漏了 `platform === "web"`；陈旧覆盖警告只在 `--dump-config` 出现；技能目录刷新语义、`skill` 工具失败形态、`dsh-agent-preset` 的挂载方式（`customSkillDirs` rank 300，不是 `bundledSkillDir`）、发现阶段会读整份文件、`register` 与 `registerProvider` 重名行为不同、缺少调用策略四组合表等。

**第二轮（插件构建的事实断言）**

- 阻断级 1 条：我把**下一版**的子路径插件行为写成了本机行为。本机 0.2.0-rc.2 仍会读 `<subpath>/package.json`（`readPluginMeta` 的 JSDoc 写明 specifier "including any package subpath"；官方 `upgrade-guide/v0.2.0-rc.2/subpath-plugin-display-manifest/` 专文说明下一版才不再读）。
- 应修正 6 条：推荐给读者的 slot 检索命令**指向了不存在的目录**（in-box bundle 在 dsh 安装目录，profile 的 `node_modules` 里没有 `@deepseek-ai/`，命令静默返回 0 行）；"客户端组合在 start 阶段、`--help` 覆盖不到"**机制说反了**（`ClientModuleRegistry` 只 `inject: ['loader']`，构造期就 compose，插一个 `clientModules` 消费者能在 `--help` 看到它激活；真正原因是事件驱动的 flush 把失败降级成 `ctx.logger.warn`）；"组合期会拒绝缺失提供方"过度断言（指向不存在的行只是不加边）；override 失败一处写"静默"一处写"大声"自相矛盾；安装拒绝的输出块把 CLI 另印的一行当成了安装器原文；`SKILL_NAME` 正则的出处文件写错。

结论：**"外部来源不可全信"这条纪律同样适用于我自己写的东西。** 两轮里最贵的几条都不是"查不到资料"，而是我**照抄文档示例签名**、**把命令写进文档却没跑一遍**、以及**从一个现象推出错误机制**（客户端组合时机、`ctx.get` 可见性）。
