# dsh-plugin-skills

![Validate](https://img.shields.io/github/actions/workflow/status/Thatgfsj/dsh-plugin-skills/validate.yml?branch=master)
![License](https://img.shields.io/badge/license-MIT-blue)
![DSH](https://img.shields.io/badge/DSH-0.2.1--rc.2-blue)

给 AI agent 用的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）技能包：**怎么构建 DSH 插件**，以及**怎么写 DSH 技能**。

> ⚠️ **时效性**：所有"已实测"结论基于 **`dsh --version = 0.2.1-rc.2`**（2026-10，npm `next` 通道）。DSH 每个版本都会翻转一些行为，本仓库会跟着版本重验并在 [sources.md](dsh-plugin-construction/references/sources.md) 里写明"这条适用于哪版"。**0.2.0 → 0.2.1 的破坏性变更**：`engines.dsh` 从纯声明变成强制且优先于 peer、子路径插件不再读 `package.json`、图标也能用 `exports["./icon"]`、`dsh plugin --profile` 位置固定。升级后第一件事是读 `docs/upgrade-guide/<版本>/`。

## 包含的技能

| 技能 | 用途 |
|---|---|
| [dsh-plugin-construction](dsh-plugin-construction/SKILL.md) | 构建/打包/安装/验证/排障 DSH 插件与 bundle：`package.json` 的 `dsh` 字段、`cordis.patch.yml`、Host 插件契约、Web UI 客户端插件、依赖解析与 profile 层序、静默失败排查 |
| [dsh-skill-authoring](dsh-skill-authoring/SKILL.md) | 编写/组织/验证 DSH 技能：发现根目录与优先级、frontmatter 校验规则、资源目录、调用策略、目录长度上限、"写完为什么没被加载" |
| [dsh-plugin-construction/references/internals](dsh-plugin-construction/references/internals/README.md) | **DSH 内部结构解构**：Cordis 基底、启动与组合、一次 turn 的运行时、服务地图、扩展缝阶梯、UI 半边、官方插件解剖与重构检查单 |

`dsh-plugin-construction` 的参考文件：

| 文件 | 内容 |
|---|---|
| [plugin-package.md](dsh-plugin-construction/references/plugin-package.md) | `dsh` 字段与类型定义、bundle/profile 语义、加载层序、依赖解析、版本兼容门、分发形态 |
| [host-plugin.md](dsh-plugin-construction/references/host-plugin.md) | 插件三种导出形态、生命周期与清理、Config、服务与依赖、事件模型、`defineTool`、会话红线 |
| [client-plugin.md](dsh-plugin-construction/references/client-plugin.md) | `dsh.client`、`window.__ModuleLoader__`、slot 注册、主题与 locale、展示元数据、验证边界 |
| [install-verify.md](dsh-plugin-construction/references/install-verify.md) | `dsh plugin` 安装、三级验证阶梯、排障表、清理 |
| [sources.md](dsh-plugin-construction/references/sources.md) | 来源清单、版本差异对照、实测清单、**未验证项**、审查记录 |
| [internals/](dsh-plugin-construction/references/internals/README.md) | DSH 内部结构：基底、启动链路、运行时、服务地图、扩展缝、UI、官方插件解剖 |
| [internals/generated/](dsh-plugin-construction/references/internals/generated/README.md) | 机器生成：服务 / 事件 / slot / 包四张表（随 dsh 版本变化） |

## 安装

DSH 的文件系统技能提供方按 `<root>/<name>/SKILL.md` **一层深**发现技能，用户级根目录是 `$DSH_HOME/skills`（默认 `~/.dsh/skills`）。

```sh
git clone https://github.com/Thatgfsj/dsh-plugin-skills.git
cd dsh-plugin-skills
bash scripts/install.sh          # 复制到 ~/.dsh/skills
bash scripts/install.sh --dry-run # 只看会做什么
```

或者把仓库目录加进配置的 `customSkillDirs`（rank 300），或者手工把技能目录拷进 `~/.dsh/skills/`。装完新开一个会话即可在技能目录里看到它们。

## CI 策略

**不在每次 PR / push 时构建和跑检查。** 这个仓库交付的是数据（Markdown 技能），不是要编译的代码；评审时本地跑两条命令即可：

```sh
node scripts/validate-skills.mjs      # 技能格式与相对链接
node scripts/dsh-map.mjs --check      # 内部结构生成表是否过期
```

CI 只在**发布时**跑：打 `v*` tag、发布 release，或手动 `workflow_dispatch`。

## 校验

```sh
node scripts/validate-skills.mjs
```

零依赖。**FAIL 集合只放 DSH 真会拒绝、导致技能被静默丢弃的问题**：bundle 形态、kebab-case 名、`name`/`description` 必填、调用布尔值合法、**旧的驼峰调用键**（`disableModelInvocation` 等，DSH 会直接报错丢弃）、相对 Markdown 链接失效。

**WARN 集合放本仓库的风格规则**：description 超过 500 字符（DSH 是**截断**不是丢弃，模型只看得到前 500）、frontmatter `name` 与目录名不一致（DSH 允许，本仓库要求一致）。CI 每次 push/PR 都会跑（`validate.yml`）。

## 证据纪律

本仓库的写法是：**每条硬结论都标注来源与核实方式，并明确列出没验证到的部分**。

这些技能由独立子代理做过只读事实审查（对照本机安装产物源码逐条核验），并**跟着 DSH 版本重验**：累计修掉 4 条阻断级与 17 条应修正问题，记录见 [sources.md](dsh-plugin-construction/references/sources.md#审查与适配记录)。外部资料（官方文档、第三方技能、博客）一律按"**本机代码/产物 > 官方仓库对应 tag 的文档 > 第三方文档**"取舍，冲突处写明分歧。

几个被实测推翻或补充的常见说法：

- **`engines.dsh` 一旦声明就单独决定兼容性**，同一份清单里的 `peerDependencies` 会被忽略——实测：兼容的 `engines.dsh` + 不兼容的 peer 能装上，反过来的组合被拒。
- 图形插件不声明 `peerDependencies` 时，`@deepseek-ai/*` import 会 `ERR_MODULE_NOT_FOUND`，插件行不加载且**很可能没有任何报错**。
- 有 `exports` 却不导出 `./package.json` / `./locale/*.json`，图标与标题会**静默丢失**。
- `ctx.get()` 不要求 `inject`，但默认只返回已激活的实现；返回 `undefined` 不等于服务不存在。
- UI 半边不能靠 `--help` 冒烟验证——客户端组合其实会跑，但失败被降级成 `logger.warn`，看不到输出。
- 第三方 `dsh-plugin-guide` 里"导出 `./icon`"一条在 0.2.0-rc.2 上**不成立**、到 0.2.1-rc.2 又**成立**——这类"今天对的明天错"正是本仓库坚持标版本号的原因。

## License

MIT
