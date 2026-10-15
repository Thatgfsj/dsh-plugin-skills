---
name: dsh-plugin-construction
description: 在 DeepSeek Harness（DSH）里构建、打包、安装、验证和排障插件与 bundle。覆盖 package.json 的 dsh 字段、cordis.patch.yml、Host 插件契约、Web UI 客户端插件、依赖解析与 profile 层序、静默失败排查，并标注官方文档/第三方教程与本机运行时的版本差异。当需要新增或修改 DSH 插件、把本地插件装进 profile、排查"装了没反应"，或判断某条外部教程是否适用于本机版本时使用。
whenToUse: 用户要求开发、打包、安装、调试 DSH 插件/bundle/UI 小部件/MCP 接入，或询问 DSH 插件怎么写、为什么没生效时。
---

# DSH 插件构建

**先确认版本，再动手。** 本技能的"已实测"结论全部基于本机运行时 `dsh --version = 0.2.0-rc.2`（2026-10 采样）。官方 master 当时是 `0.2.1-alpha.4`，第三方教程多按更早或更晚的版本写，**同一字段在不同版本含义不同**。差异清单见 `references/sources.md`。

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
4. **装进 profile**：`dsh plugin --profile <name> add <绝对路径或包名>`。**不要手写 profile 的 `package.json`/`cordis.patch.yml`，不要在 profile 目录里跑 pnpm。**
5. **验证**：先用 `dsh --profile <name> --dump-config` 看层和行有没有挂上、有没有 `patch: entry "x" not found`；再用 `dsh --profile <name> --patch <overlay.yml> --help` 做秒级冒烟（Host 半边 `apply` 会真的执行并打印日志）。UI 半边需要真实页面，见 `references/install-verify.md`。注意 `patch: entry "x" not found` 这条警告**只在 `--dump-config` 路径打印**，`--help` 冒烟看不到。

## 红线（违反会出现"静默失效"）

- **共享宿主实例的 `@deepseek-ai/*` 包（`dsh-*`、`cordis`、`schemastery` 等）必须同时写进 `peerDependencies` 和 `devDependencies`，绝不放进 `dependencies`。** 机制是模块解析：插件目录向上找不到该包时 import 抛 `ERR_MODULE_NOT_FOUND`，该行不加载，而且**很可能看不到任何报错**（实测：link 安装且未声明 peer 时该 import 直接失败、插件整行不生效；补上 peer 后同一份代码立刻加载）。已被 profile 的 `node_modules` 提升到解析路径上的包不受影响。
- **不要用新的 `type` 追加会话事件**（`Session.append()` 写不出 `ignorable: true`，会让会话打不开）。状态从既有事件推导，或放进 storage 服务。
- **不要读写未在 `inject` 里声明的 `ctx.<service>`**：属性代理会抛错（源码文案 `cannot get property "x" without inject`），插件在该处中止、后续注册全部不发生，而且不一定有可见诊断。`ctx.get()` **不要求 inject**，但默认只返回已激活的实现——返回 `undefined` ≠ 服务不存在。
- **覆盖（override）已存在的行时，`config` 是整体替换不是深合并**，必须重述该行需要的每个键；上游删行后 override 会被跳过——**但不是无声**：`--dump-config` 会打 `patch: entry "id" not found`，而普通启动/`--help` 未必显示，所以升级上游后要专门跑一次 `--dump-config`。
- **UI 半边：只渲染 slot 里的 React 组件**，不 iframe、不 `require` 任何 `@deepseek-ai/dsh-client-*` 包、不在组件外写 DOM、不往 `document.body` 追加；样式只用 `--dsw-alias-*` 主题 token。
- **交付要有展示元数据**：`locale/en.json` 的 `meta.title`/`meta.description` + **顶层 `package.json.icon`**（本机版本；见下）。

## 本机版本的两个高频坑（已实测）

1. **图标声明方式**：`0.2.0-rc.2` 只认 `package.json` 顶层的 `"icon": "./icon.svg"`（类型定义 `DshPackageManifest.icon`，path 相对于 manifest、realpath 后必须在包内、≤256 KiB，支持 SVG/PNG/JPEG/WebP）。"导出 `./icon`" 是 master（≥0.2.1）的新写法，本机不生效。真实第三方插件 `dsh-dream-skin@10.15.0` 用的正是顶层 `icon`。另外：**只要包里有 `exports`，就必须显式导出 `"./package.json"` 与 `"./locale/*.json"`**，否则图标与 locale 元数据会**静默丢失**（解析抛 `ERR_PACKAGE_PATH_NOT_EXPORTED`，被内部吞掉）；详见 `references/client-plugin.md`。
2. **安装期会强制 peer 范围**：`dsh plugin add` 会用运行时版本比对插件声明的 `@deepseek-ai/dsh-*` peer 区间，不匹配就**拒绝安装**（实测：`dsh plugin --profile <p> add @deepseek-ai/dsh-web-app` 从公共 npm 取到 `0.0.1-rc.1` 后被拒绝）。`engines.dsh` 是纯声明、不强制。

## 参考文件

| 需要什么 | 读哪个 |
|---|---|
| `package.json` 的 `dsh` 字段、bundle/profile 语义、层序、依赖解析 | `references/plugin-package.md` |
| Host 插件契约：形态、生命周期、Config、服务、事件、工具 | `references/host-plugin.md` |
| Web UI 客户端插件：`dsh.client`、`__ModuleLoader__`、slots、主题、locale | `references/client-plugin.md` |
| 安装、冒烟测试、排障表、清理 | `references/install-verify.md` |
| 来源清单、版本差异对照、**未验证项** | `references/sources.md` |

## 证据纪律

本技能每条硬结论都标注了来源与核实方式。**外部资料一律不可全信**：官方技能 `cordis-plugin-development`（随 dsh 一起装）描述的是它自己那一版的行为；第三方 `dsh-plugin-guide` 覆盖面广但按 `0.2.1-alpha.2+` 写，其中"`./icon` 导出"一条在本机不成立。冲突时按 **本机代码/产物 > 官方仓库 master 文档 > 第三方文档** 取舍，并把分歧写进交付说明。`references/sources.md` 列出了我没有验证到的部分。
