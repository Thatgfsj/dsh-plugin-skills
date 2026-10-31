---
name: dsh-plugin-construction
description: 在 DeepSeek Harness（DSH）里构建、打包、安装、验证和排障插件与 bundle。覆盖 package.json 的 dsh 字段、cordis.patch.yml、Host 插件契约、Web UI 客户端插件、依赖解析与 profile 层序、静默失败排查，并标注官方文档/第三方教程与本机运行时的版本差异。当需要新增或修改 DSH 插件、把本地插件装进 profile、排查"装了没反应"，或判断某条外部教程是否适用于本机版本时使用。
whenToUse: 用户要求开发、打包、安装、调试 DSH 插件/bundle/UI 小部件/MCP 接入，或询问 DSH 插件怎么写、为什么没生效时。
---

# DSH 插件构建

**先确认版本，再动手。** 本目录对应 `dsh 0.2.1-rc.4`，内容来自**静态分析（tag dsh-v0.2.1-rc.4 + 官方文档差分），未在本机运行时验证**。标为"已实测"的结论最早来自 `0.2.1-rc.2` 的运行时验证；rc.3 与本版都是静态分析，两版之间插件作者相关面经源码差分确认无改动（见 `../STATUS.md`）。

## 心智模型（四层，别搞混）

| 层 | 是什么 | 谁写 | 关键文件 |
|---|---|---|---|
| 插件（plugin） | 一个导出 `apply(ctx, config)` 的模块（或服务类默认导出） | 作者 | `index.js` |
| 组合包（bundle） | 带配置层的 npm 包，声明 `dsh.bundle.patch` | 作者 | `cordis.patch.yml` |
| profile | `~/.dsh/profiles/<name>/` 下可启动的组合，声明 `dsh.profile.bundles` | `dsh plugin` 命令维护 | `package.json` + `cordis.patch.yml` |
| 客户端半边 | 浏览器 bundle，声明 `dsh.client`，导出 `./client` | 作者 | `client.js` |

bundle 是你分发的东西，profile 是用户启动的东西，**没有东西同时是两者**。

## 标准流程

1. **确认目标版本**：`dsh --version`。宿主没有 `plugin_manager` / `cordis_inspect_query` 工具时（例如普通 Web 会话），用下面 CLI 路径，不要照抄官方技能里的工具调用。
2. **选扩展点**：先用最弱的够用机制 —— `ctx.tools.restrict()`（只能移除）< `ctx.tools.guard()`（只能拒绝）< waterfall 监听器改写（依赖注册顺序）< `system-prompt/assemble`（整段替换）。详见 `references/host-plugin.md`。
3. **写包**：最小 Host 插件 = `package.json`（含 `dsh.bundle.patch`）+ `cordis.patch.yml`（`insert:` 一行 `id`/`name`）+ `index.js`。要进模型/配置的东西一律走 `ctx.effect()` / `ctx.on()` / 注册表。
4. **装进 profile**：`dsh plugin --profile <name> add <路径或包名>`。`--profile` 必须写在转发给 pnpm 的参数**之前**（0.2.1 新规则）；相对路径（`.`, `../plugin`, `file:`, `link:`）锚定在**你调用命令的目录**，所以在插件仓库里 `add .` 装的就是当前 checkout。装完 `dsh.profile.bundles` 会自动对齐。**不要手写 profile 的 `package.json`/`cordis.patch.yml`，不要在 profile 目录里跑 pnpm。**
5. **验证**：三级阶梯（见 `references/install-verify.md`）：`--dump-config`（层与行）/ `--dump-config-schema`（0.2.1 新增，不挂载就能校验 patch 写法）→ `--patch <overlay> --help` 秒级冒烟（`apply` 真执行）→ 真实页面验 UI。`patch: entry "x" not found` **只在 `--dump-config` 打印**。

## 红线（违反会出现"静默失效"）

- **共享宿主实例的 `@deepseek-ai/*` 包必须同时写进 `peerDependencies` 和 `devDependencies`，绝不放进 `dependencies`。** 插件目录解析不到时 import 抛 `ERR_MODULE_NOT_FOUND`，该行不加载且**很可能没有任何报错**（实测）。见 `references/plugin-package.md`。
- **不要用新的 `type` 追加会话事件**（`Session.append()` 写不出 `ignorable: true`，会让会话打不开）。状态从既有事件推导，或放进 storage 服务。
- **不要读写未在 `inject` 里声明的 `ctx.<service>`**：属性代理会抛错（源码文案 `cannot get property "x" without inject`），插件在该处中止、后续注册全部不发生，而且不一定有可见诊断。`ctx.get()` **不要求 inject**，但默认只返回已激活的实现——返回 `undefined` ≠ 服务不存在。
- **覆盖（override）已存在的行时，`config` 是整体替换不是深合并**，必须重述该行需要的每个键；上游删行后 override 会被跳过——**但不是无声**：`--dump-config` 会打 `patch: entry "id" not found`，而普通启动/`--help` 未必显示，所以升级上游后要专门跑一次 `--dump-config`。
- **UI 半边：只渲染 slot 里的 React 组件**，不 iframe、不 `require` 任何 `@deepseek-ai/dsh-client-*` 包、不在组件外写 DOM、不往 `document.body` 追加；样式只用 `--dsw-alias-*` 主题 token。
- **交付要有展示元数据**：`locale/en.json` 的 `meta.title`/`meta.description` + 图标（顶层 `package.json.icon` 或 `exports["./icon"]`，前者优先）。有 `exports` 就必须把 `./package.json` 与 `./locale/*.json` 也导出，否则以上全部静默失效。
- **发布前给包声明 `engines.dsh`**：它一旦存在就单独决定兼容性并让 peer 检查失效，写错区间等于把自己锁在某个 dsh 版本外。

## 0.2.1 三个易错点（细节见 references）

1. **`engines.dsh` 真强制，而且压过 peer**：声明了它就由它**单独**决定兼容性，peer 被忽略；没有才回退 peer。实测 `engines.dsh: ">99.0.0"` 被拒，而"兼容 engines + 不兼容 peer"**装得上**。所以区间要覆盖你支持的**所有** dsh 版本；`workspace:` 在这里非法。见 `references/plugin-package.md`。
2. **展示元数据**：图标支持顶层 `package.json.icon`（优先）与 `exports["./icon"]` 两种；但只要包里有 `exports`，就必须导出 `"./package.json"` 与 `"./locale/*.json"`，否则图标与标题**静默丢失**。见 `references/client-plugin.md`。
3. **子路径插件**（`<pkg>/search`）**不再读 `package.json`**：文案走 `<pkg>/search/locale/*.json`，图标走导出的 `<pkg>/search/icon`。

## 先读内部结构（做一个"接得进生态"的插件）

**插在哪一层、为什么**取决于 DSH 怎么运转。动手前至少读一条路径（索引：`references/internals/README.md`）：

| 你要做的事 | 读这条路径 |
|---|---|
| 写一个新插件 | `internals/05-extension-seams.md` → `internals/01-substrate-cordis.md` → `internals/08-design-playbook.md` |
| **重构/替换官方插件** | `internals/07-official-plugin-anatomy.md` → `internals/02-boot-composition.md` → `internals/03-agent-runtime.md` |
| 排查"没反应 / 升级后坏了" | `internals/09-reading-source.md` → `internals/02-boot-composition.md` |

一句话：DSH 是**配置层叠出来的 Cordis 插件树**，没有特权内核；扩展靠新增一层，策略靠事件，能力靠服务键，注册皆可回收。

`internals/generated/` 的四张表由 `scripts/dsh-map.mjs` 从已安装 dsh 生成，随版本变，不要手改或背诵。

## 参考文件

| 需要什么 | 读哪个 |
|---|---|
| `package.json` 的 `dsh` 字段、bundle/profile 语义、层序、依赖解析 | `references/plugin-package.md` |
| Host 插件契约：形态、生命周期、Config、服务、事件、工具 | `references/host-plugin.md` |
| Web UI 客户端插件：`dsh.client`、`__ModuleLoader__`、slots、主题、locale | `references/client-plugin.md` |
| 安装、冒烟测试、排障表、清理 | `references/install-verify.md` |
| 来源清单、版本差异对照、**未验证项** | `references/sources.md` |
| **DSH 内部结构**、扩展缝、官方插件解剖、阅读与验证配方 | `references/internals/README.md` |

## 证据纪律

每条硬结论都标了来源与核实方式。**外部资料一律不可全信**：版本一升，昨天的正确就是今天的错误（0.2.0→0.2.1 里 `./icon` 从"不生效"变"支持"，`engines.dsh` 从"纯声明"变"强制优先"）。冲突时按 **本机代码/产物 > 官方对应 tag 文档 > 第三方** 取舍。未验证项见 `references/sources.md`。
