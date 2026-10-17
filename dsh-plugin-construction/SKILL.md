---
name: dsh-plugin-construction
description: 在 DeepSeek Harness（DSH）里构建、打包、安装、验证和排障插件与 bundle。覆盖 package.json 的 dsh 字段、cordis.patch.yml、Host 插件契约、Web UI 客户端插件、依赖解析与 profile 层序、静默失败排查，并标注官方文档/第三方教程与本机运行时的版本差异。当需要新增或修改 DSH 插件、把本地插件装进 profile、排查"装了没反应"，或判断某条外部教程是否适用于本机版本时使用。
whenToUse: 用户要求开发、打包、安装、调试 DSH 插件/bundle/UI 小部件/MCP 接入，或询问 DSH 插件怎么写、为什么没生效时。
---

# DSH 插件构建

**先确认版本，再动手。** 本技能的"已实测"结论基于本机运行时 `dsh --version = 0.2.1-rc.2`（2026-10 采样，npm `next` 通道；`latest` 当时仍是 `0.2.0-rc.2`）。**0.2.0 → 0.2.1 有破坏性变更**：`engines.dsh` 从纯声明变成强制且优先于 peer、图标与子路径展示元数据改了、`dsh plugin` 的参数位置改了。每条结论都标了适用版本，差异清单见 `references/sources.md`。官方每次破坏性变更都有一篇 `docs/upgrade-guide/<版本>/<主题>/guide.md`，升级后第一件事是读那一版目录。

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
5. **验证**：三级阶梯，见 `references/install-verify.md`。① `dsh --profile <name> --dump-config`（层与行）、`--dump-config-schema`（0.2.1 新增，直接给出行/补丁的 JSON Schema，不用挂载就能校验 patch 写法）；② `dsh --profile <name> --patch <overlay.yml> --help` 秒级冒烟（Host 半边 `apply` 真执行、effect 注册与释放都会打印）；③ UI 半边要真实页面。注意 `patch: entry "x" not found` **只在 `--dump-config` 打印**，`--help` 冒烟看不到。

## 红线（违反会出现"静默失效"）

- **共享宿主实例的 `@deepseek-ai/*` 包（`dsh-*`、`cordis`、`schemastery` 等）必须同时写进 `peerDependencies` 和 `devDependencies`，绝不放进 `dependencies`。** 机制是模块解析：插件目录向上找不到该包时 import 抛 `ERR_MODULE_NOT_FOUND`，该行不加载，而且**很可能看不到任何报错**（实测：link 安装且未声明 peer 时该 import 直接失败、插件整行不生效；补上 peer 后同一份代码立刻加载）。已被 profile 的 `node_modules` 提升到解析路径上的包不受影响。
- **不要用新的 `type` 追加会话事件**（`Session.append()` 写不出 `ignorable: true`，会让会话打不开）。状态从既有事件推导，或放进 storage 服务。
- **不要读写未在 `inject` 里声明的 `ctx.<service>`**：属性代理会抛错（源码文案 `cannot get property "x" without inject`），插件在该处中止、后续注册全部不发生，而且不一定有可见诊断。`ctx.get()` **不要求 inject**，但默认只返回已激活的实现——返回 `undefined` ≠ 服务不存在。
- **覆盖（override）已存在的行时，`config` 是整体替换不是深合并**，必须重述该行需要的每个键；上游删行后 override 会被跳过——**但不是无声**：`--dump-config` 会打 `patch: entry "id" not found`，而普通启动/`--help` 未必显示，所以升级上游后要专门跑一次 `--dump-config`。
- **UI 半边：只渲染 slot 里的 React 组件**，不 iframe、不 `require` 任何 `@deepseek-ai/dsh-client-*` 包、不在组件外写 DOM、不往 `document.body` 追加；样式只用 `--dsw-alias-*` 主题 token。
- **交付要有展示元数据**：`locale/en.json` 的 `meta.title`/`meta.description` + 图标（顶层 `package.json.icon` 或 `exports["./icon"]`，前者优先）。有 `exports` 就必须把 `./package.json` 与 `./locale/*.json` 也导出，否则以上全部静默失效。
- **发布前给包声明 `engines.dsh`**：它一旦存在就单独决定兼容性并让 peer 检查失效，写错区间等于把自己锁在某个 dsh 版本外。

## 0.2.1 的三个高频坑（已实测）

1. **`engines.dsh` 现在真强制，而且压过 peer。** 声明了 `engines.dsh` 时，**它单独决定**兼容性，`@deepseek-ai/dsh*` 的 `peerDependencies` 被**忽略**；只有当 `engines.dsh` 不存在时才回退到 peer 规则；两者都没有则不设约束。安装与 profile 启动都会拒绝。实测（本机 0.2.1-rc.2）：`engines.dsh: ">99.0.0"` → `installation rejected ... requirements {"engines.dsh":">99.0.0"}`；**同时**声明兼容的 `engines.dsh` 与不兼容的 peer → **安装成功**（engines 赢）。所以声明了 `engines.dsh` 就必须让它覆盖你真正支持的**所有** dsh 版本；`workspace:` 在 `engines.dsh` 里非法；`engines` 不是对象或 `engines.dsh` 不是字符串会被当成**畸形清单**而拒绝。
2. **展示元数据两处有坑。** ① 图标现在**两种写法都支持**：顶层 `package.json.icon`（相对 manifest、realpath 后必须在包内、≤256 KiB、SVG/PNG/JPEG/WebP）**优先**，没有该字段时才回退到 `exports["./icon"]`（0.2.0-rc.2 只支持前一种）。② 只要包里有 `exports`，就必须显式导出 `"./package.json"` 与 `"./locale/*.json"`，否则图标与 locale 元数据**静默丢失**（解析抛 `ERR_PACKAGE_PATH_NOT_EXPORTED` 后被内部吞掉）。
3. **子路径插件不再读 `package.json`。** `<pkg>/search` 这类子路径说明符在 0.2.0-rc.2 仍会读 `<pkg>/search/package.json`，**0.2.1-rc.2 起一律不读**：文案走 `<pkg>/search/locale/*.json`，图标走导出的 `<pkg>/search/icon`。给子路径插件做展示，要在它的 `exports` 里各自导出。

## 参考文件

| 需要什么 | 读哪个 |
|---|---|
| `package.json` 的 `dsh` 字段、bundle/profile 语义、层序、依赖解析 | `references/plugin-package.md` |
| Host 插件契约：形态、生命周期、Config、服务、事件、工具 | `references/host-plugin.md` |
| Web UI 客户端插件：`dsh.client`、`__ModuleLoader__`、slots、主题、locale | `references/client-plugin.md` |
| 安装、冒烟测试、排障表、清理 | `references/install-verify.md` |
| 来源清单、版本差异对照、**未验证项** | `references/sources.md` |

## 证据纪律

本技能每条硬结论都标注了来源与核实方式。**外部资料一律不可全信**：官方随包技能 `cordis-plugin-development` 描述的是它自己那一版的行为；第三方教程按各自声明的版本写，而且**版本一升就可能从正确变错误**——2026-10 的 0.2.0 → 0.2.1 升级里，第三方 `dsh-plugin-guide` 曾推荐的"导出 `./icon`"从"本机不生效"变成了"支持"，而反过来 `engines.dsh` 从"纯声明"变成了"强制且优先"。冲突时按 **本机代码/产物 > 官方仓库对应 tag 的文档 > 第三方文档** 取舍，并把分歧写进交付说明。`references/sources.md` 列出了我没有验证到的部分。
