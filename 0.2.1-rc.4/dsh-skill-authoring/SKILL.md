---
name: dsh-skill-authoring
description: 在 DeepSeek Harness 中编写、组织、验证与排障 agent 技能（SKILL.md）。覆盖发现根目录与优先级、frontmatter 字段与校验规则、bundle 资源目录、模型/用户调用策略、目录描述长度上限，以及"写完为什么没被加载"的排查方法。当需要新建或修改 `~/.dsh/skills`、项目 `.dsh/skills`、`.agents/skills` 下的技能，或把某套流程/知识固化成可复用技能时使用。
whenToUse: 用户要求把资料整理成 skill、新增或修改 SKILL.md、排查技能没被发现或没生效时。
---

# 编写 DSH 技能（SKILL.md）

事实来源：`dsh 0.2.1-rc.4` 的 tag 源码（静态分析，未在本机运行）。技能的发现与格式在 0.2.1 各 rc 之间无变化（差分确认）。

## 技能放哪里（发现是**一层深**，不递归）

| Rank | 来源 | 路径 |
|---|---|---|
| 100 | `project-dsh` | `<projectRoot>/.dsh/skills` |
| 200 | `project-agents` | `<projectRoot>/.agents/skills` |
| 300 | `custom` | 配置的 `customSkillDirs` |
| 400 | `user-dsh` | `<dshHome>/skills`（默认 `~/.dsh/skills`，**跳过 `.system` 子目录**） |
| 500 | `user-agents` | `<agentsHome>/skills`（默认 `~/.agents/skills`） |
| 600 | bundled | `$DSH_BUNDLED_SKILL_DIR` / 配置的 `bundledSkillDir` |

- `projectRoot` = 最近的含 `.git` 的祖先目录；没有就用当前 cwd。
- 只识别 `<root>/<name>/SKILL.md` 和 `<root>/<name>.md` 两种形态。**`<root>/a/b/SKILL.md` 这种嵌套不会被发现**，不要按"技能集合目录"来组织。
- 反过来要注意：扁平形态下，根目录里**任何 `*.md` 都是候选**。把 `customSkillDirs` 指向一个仓库根，`README.md` 也会被当成技能读一遍，然后因为缺 frontmatter 被丢弃并在日志里告警。
- 重名时：离得近的层赢；同一层里按 rank、提供方注册顺序、提供方内部顺序裁决。被遮蔽的定义没有 API 可查。

## frontmatter（YAML，必须两个字段）

```markdown
---
name: my-skill-name
description: 做什么 + 什么时候用（关键词要写全，模型只先看到这一行）
whenToUse: 可选的补充触发说明
# disable-model-invocation: true   # 从模型目录与 loader 中排除
# user-invocable: false            # 从面向用户的命令中排除
# metadata: {...}                  # 可选附加信息
---

正文……
```

已核实的校验规则：

- `name` 必须匹配 `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`（kebab-case，无大写、无下划线、无连续短横）。目录名与 `name` 保持一致最省事。
- `name` 或 `description` 缺失、YAML frontmatter 畸形、名字非法、调用布尔值非法 → **整个技能被丢弃**，只在日志里留一条 `skill file <path> ignored: ...` 警告。模型目录**不会**告诉你有东西坏了，也不会区分"不存在"和"写错了"。
- 调用布尔值接受 YAML 布尔与大小写不敏感的 `true/false`、`yes/no`、`on/off`、`1/0`；拼错会整条丢弃，而不是静默按默认放行。
- **旧的驼峰键会被显式拒绝并整条丢弃**：`disableModelInvocation` / `modelInvocable` / `userInvocable` 每个都会抛 `frontmatter field "<旧键>" is unsupported; use "<新键>"`。从老文档抄配置时，这是最常见的"技能消失"原因。
- `disable-model-invocation: true` 与 `user-invocable: false` 是两个独立开关，默认都允许，四种组合：

| 组合 | 模型目录 / `skill` 工具 | 用户入口 |
|---|---|---|
| 省略两键（默认） | 包含 | 包含 |
| `disable-model-invocation: true` | 排除 | 包含 |
| `user-invocable: false` | 包含 | 排除 |
| 两者都设 | 排除 | 排除（只剩可信的 `ctx.skills.get()` 调用方看得见） |

"用户入口"指浏览器里的技能目录（按 `userInvocable` 过滤）和用户消息里的 `/<name>` 手势。两者与模型侧互不影响。
- 正文 = frontmatter 之后的全部内容（会 `trim`）。发现阶段会**读取整份文件**，但只保留 frontmatter 字段，正文被丢弃、不进入目录缓存；每次加载都重读当前文件，所以改正文不需要版本号或缓存失效。

## 目录描述会被截断

`dsh-tool-skill` 的 `catalogDescriptionMaxLength` 默认 **500 字符**，按**空白归一化后**的长度判断，超出部分**截断**（保留前 497 字符 + `...`），**不是丢弃技能**。模型的初始技能目录只渲染 `name` + 截断后的 `description`，所以：

- 把"做什么 / 什么时候用"写在 description 的前半段，别把它当摘要写作。
- 触发词（同义词、用户可能用的中英文说法）要进去，否则模型不会来加载你。

## 技能里的资源

- 技能的 resource base 就是 `SKILL.md` 所在目录。`references/`、`scripts/`、`assets/` 是约定俗成的子目录，加载技能时会把 resource base 指给模型。
- **模型目录只由 `name` + 空白归一化并截断后的 `description`（以及 `disable-model-invocation` 造成的过滤）决定**：只有改这几项才会改变模型看到的目录内容。纯正文、`whenToUse`、`metadata`、`user-invocable` 的改动都不刷新目录，只影响下一次加载；`references/` 等资源目录的改动同样不进目录。
- 因为 digest 用的是**截断后**的 description，改动落在 500 字符窗口之外时，模型目录**不会**刷新（但下一次加载会读到新正文/新 frontmatter）——把重要信息写在前面，也让改动更容易被模型感知。
- 发现是"目录 + 正文"分离的：目录缓存有上限（注册表 `collectCacheMaxEntries` 默认 128），正文从不缓存。

## 写完之后怎么验证

1. **看会话目录**：新建一个会话（或让宿主刷新）后，技能应出现在可用技能列表里。实测：把技能写进 `~/.dsh/skills/` 后，当前会话的技能目录立刻出现了它（watcher 生效）。
2. **没出现就查日志**：`skill file <path> ignored: ...` 会点名原因（缺字段 / 名字非法 / frontmatter 非法 / 调用布尔值非法）。
3. **路径自检**：确认是 `<root>/<name>/SKILL.md` 或 `<root>/<name>.md`，且 `<root>` 是上表里的某一层；`~/.dsh/skills/.system/` 下的东西会被跳过。
4. 有 `skill` 工具时直接按名字加载一次，正文能返回即为可用。两种 API 的失败形态不同：`skill` 工具对「名字非法 / 未知或已下线 / 不可被模型调用」三种情况都**抛错**；而注册表 API `ctx.skills.get(name)` 对非法名字返回 `undefined`、不报错。

## 内容写法

- 技能是**可复用的工作流与判据**，不是知识库倾倒。把"什么时候用哪一步、判断标准是什么、失败怎么查"写清楚；事实细节用相对路径指到资源文件或权威来源。
- 采用**渐进式披露**：`SKILL.md` 保持能一眼扫完的骨架 + 一张"需要什么读哪个文件"的表，细节放 `references/*.md`。
- 硬结论标注来源与核实方式；外部资料（官方文档、第三方技能、博客）可能对应不同版本，**写清它适用于哪个版本**，别把某版行为当成永恒事实。
- 不要复制别人的技能内容当自己的：先核实，再写，冲突处明确写分歧。

## 从插件里注册技能（可选路径）

插件可以在内存里注册技能，不需要落盘：

```ts
export const inject = ['skills']
export function apply(ctx) {
  // register 只收一个参数；source 与 content 必填（正文不是第二个参数）
  ctx.skills.register({
    name: 'my-skill', description: '...', whenToUse: '...',
    source: 'runtime', content: '正文……',
  })
  // registerProvider 收的是工厂 (control) => provider，不是 provider 对象
  ctx.skills.registerProvider(() => provider)
}
```

- 运行时注册的提供方标签是保留值 `runtime`。同名冲突的处理不同：**运行时技能 `register()` 同层同名先到先得并记警告**；**提供方 `registerProvider()` 重名直接抛错**（`a skill provider named "…" is already registered`）。
- 发行版里两种挂载方式都在用：
  - `@deepseek-ai/dsh-agent-preset` 把技能放在包内 `skills/` 目录，由 **`customSkillDirs`（rank 300）**挂载（见本机 `dsh-web-app/presets/cordis.patch.yml` 里 `skill-filesystem` 的配置）。
  - 打包装备（packaged provider）则用 **rank 600**：`dsh-skill-office`（provider `dsh-office`，7 个技能）、`dsh-skill-badge`（provider `dsh-badge`，缺省不挂载，需要显式 insert）、`dsh-sandbox-windows-acl` 的 ACL 技能。**0.2.1 起 rank 600 就是官方打包 skill provider 的标准 rank**。
- 第三方 `dsh-plugin-guide` 也是"一个 bundle 附带一套 SKILL.md + 资料"的形态。这是把知识随插件分发的常用做法。
