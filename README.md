# dsh-plugin-skills

![Validate](https://img.shields.io/github/actions/workflow/status/Thatgfsj/dsh-plugin-skills/validate.yml?branch=master)
![License](https://img.shields.io/badge/license-MIT-blue)
![DSH](https://img.shields.io/badge/DSH-0.2.0--rc.2-blue)

给 AI agent 用的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）技能包：**怎么构建 DSH 插件**，以及**怎么写 DSH 技能**。

> ⚠️ **时效性**：所有"已实测"结论基于 `dsh --version = 0.2.0-rc.2`（2026-10）。官方 master 当时是 `0.2.1-alpha.4`，本仓库明确区分了"本机行为"与"上游 master 行为"——**同一字段在不同版本含义不同**（例如插件图标：本机只认顶层 `package.json.icon`，master 也支持 `exports["./icon"]`）。换版本前先读 [sources.md](dsh-plugin-construction/references/sources.md)。

## 包含的技能

| 技能 | 用途 |
|---|---|
| [dsh-plugin-construction](dsh-plugin-construction/SKILL.md) | 构建/打包/安装/验证/排障 DSH 插件与 bundle：`package.json` 的 `dsh` 字段、`cordis.patch.yml`、Host 插件契约、Web UI 客户端插件、依赖解析与 profile 层序、静默失败排查 |
| [dsh-skill-authoring](dsh-skill-authoring/SKILL.md) | 编写/组织/验证 DSH 技能：发现根目录与优先级、frontmatter 校验规则、资源目录、调用策略、目录长度上限、"写完为什么没被加载" |

`dsh-plugin-construction` 的参考文件：

| 文件 | 内容 |
|---|---|
| [plugin-package.md](dsh-plugin-construction/references/plugin-package.md) | `dsh` 字段与类型定义、bundle/profile 语义、加载层序、依赖解析、版本兼容门、分发形态 |
| [host-plugin.md](dsh-plugin-construction/references/host-plugin.md) | 插件三种导出形态、生命周期与清理、Config、服务与依赖、事件模型、`defineTool`、会话红线 |
| [client-plugin.md](dsh-plugin-construction/references/client-plugin.md) | `dsh.client`、`window.__ModuleLoader__`、slot 注册、主题与 locale、展示元数据、验证边界 |
| [install-verify.md](dsh-plugin-construction/references/install-verify.md) | `dsh plugin` 安装、三级验证阶梯、排障表、清理 |
| [sources.md](dsh-plugin-construction/references/sources.md) | 来源清单、版本差异对照、实测清单、**未验证项**、审查记录 |

## 安装

DSH 的文件系统技能提供方按 `<root>/<name>/SKILL.md` **一层深**发现技能，用户级根目录是 `$DSH_HOME/skills`（默认 `~/.dsh/skills`）。

```sh
git clone https://github.com/Thatgfsj/dsh-plugin-skills.git
cd dsh-plugin-skills
bash scripts/install.sh          # 复制到 ~/.dsh/skills
bash scripts/install.sh --dry-run # 只看会做什么
```

或者把仓库目录加进配置的 `customSkillDirs`（rank 300），或者手工把技能目录拷进 `~/.dsh/skills/`。装完新开一个会话即可在技能目录里看到它们。

## 校验

```sh
node scripts/validate-skills.mjs
```

零依赖，复刻 DSH 真正会执行的检查：bundle 形态、kebab-case 名、`name`/`description` 必填、调用布尔值合法、description 不超过 500 字符目录上限、以及技能内所有相对 Markdown 链接在磁盘上存在。CI 每次 push/PR 都会跑（`validate.yml`）。

## 证据纪律

本仓库的写法是：**每条硬结论都标注来源与核实方式，并明确列出没验证到的部分**。

这些技能由两个独立子代理做过只读事实审查（对照本机安装产物源码逐条核验），修掉了 3 条阻断级与 11 条应修正问题，记录见 [sources.md](dsh-plugin-construction/references/sources.md#审查记录本轮)。外部资料（官方文档、第三方技能、博客）一律按"**本机代码/产物 > 官方仓库 master 文档 > 第三方文档**"取舍，冲突处写明分歧。

几个被实测推翻或补充的常见说法：

- 图形插件不声明 `peerDependencies` 时，`@deepseek-ai/*` import 会 `ERR_MODULE_NOT_FOUND`，插件行不加载且**很可能没有任何报错**。
- 有 `exports` 却不导出 `./package.json` / `./locale/*.json`，图标与标题会**静默丢失**。
- `ctx.get()` 不要求 `inject`，但默认只返回已激活的实现；返回 `undefined` 不等于服务不存在。
- UI 半边不能靠 `dsh --help` 冒烟验证——客户端组合发生在插件的 `start` 阶段。
- 第三方 `dsh-plugin-guide` 里"导出 `./icon`"一条在本机 0.2.0-rc.2 **不成立**（那是 master 的新写法）。

## License

MIT
