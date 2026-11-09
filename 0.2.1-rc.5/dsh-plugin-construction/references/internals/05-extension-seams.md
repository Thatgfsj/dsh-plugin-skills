# 05 扩展缝：从最弱到最强，先问"能不能不写代码"

来源：`docs/architecture.md`（Events）、`docs/subsystems/{tools,slots,skills,system-prompt,scope}.md`、`packages/core/tools/README.md`。适用 **0.2.1-rc.2**。

## 阶梯（**从上往下选，第一条够用就停**）

| 层 | 机制 | 改什么 | 影响半径 | 升级风险 |
|---|---|---|---|---|
| 0 | 配置 / patch 覆盖层 | 别人的行参数、开关、插入顺序 | 仅本 profile | 低（但 `config` 整体替换） |
| 1 | 新增插件行 | 提供新服务、新工具、新事件 | 自己 | 低 |
| 2 | 注册表贡献 | 技能、工具、命令、slot、projection | 该注册表 | 低-中 |
| 3 | 事件监听 | 观察 / 拦截 / 改写某条链路 | 该事件的下游 | 中（顺序敏感） |
| 4 | 策略缝 | `tools.guard` / `restrict`、沙箱策略、审批、授权 | 策略命中的调用 | 中（可能挡住正当操作） |
| 5 | 提示词段 | 追加规则、注入上下文 | 每次请求的 token | 中（token 成本持续） |
| 6 | 替换官方行的实现 | 用同键新实现顶替 | **所有消费方** | 高（契约必须完全一致） |
| 7 | 客户端 slot | 往 UI 里加组件 | 页面 | 中（组件崩会白 slot） |

## 决策表：说清需求 → 直接给答案

| 你的需求 | 用哪层 | 别做 |
|---|---|---|
| 想让某个内置工具默认关闭 | 0（patch 里 `disabled: true`）或 4（`restrict`） | 别自己写个空实现去覆盖 |
| 想加一个工具 | 1 + 2（`defineTool` + `ctx.tools.register`） | 别改 `ctx.tools` 实现 |
| 想在某步之前加自己的判断 | 3（`agent/pre-step` waterfall） | 别劫持 `agentLoop` |
| 想禁止某类命令 | 4（`guard`，同步拒绝） | 别在 `tools/execute` 里做慢检查 |
| 想让模型总是遵守某条规则 | 5（提示词段） | 别替换整块 `system/message` |
| 想换掉文件读写实现 | 6（同键新实现）+ 验收清单 | 别只实现"能跑的部分" |
| 想把结果渲染成卡片 | 7（slot） | 别往 `document.body` 追加 |
| 想持久化自己的状态 | 1（storage 服务）或 `ctx.sessionProjections` | 别用新 `type` 追加会话事件 |

## 每层的真实代价

**0 配置层**：最便宜，但 `config` 是**整体替换**——用户改一个键也要重述整行。你 insert 的行必须给稳定 `id`，否则别人没法在 profile 层微调。

**1 新插件行**：唯一"零风险"的扩展。前提是你**不抢已有键**；新键要在 `declare module` 里补类型，消费方才有 `ctx.yourKey` 的类型。

**2 注册表**：`ctx.skills.register`、`ctx.tools.register`、`ctx.commands.register`、`ctx.slots.register` 都是 effect，返回 disposer 语义由注册表决定。注意同名冲突策略**各不相同**（技能 register 先到先得+警告；provider 重名直接抛错）。

**3 事件**：威力最大也最容易误伤。三条铁律：选对派发模式；`waterfall` 必须 `next()`；改写对象要展开 `{ ...decision, ... }` 否则丢字段。**监听器的执行顺序不是你能承诺的**（除 `prepend`），所以别写"我在官方之前跑"的假设。

**4 策略缝**：`guard` 是同步的、只能拒绝；`restrict` 按 agent 作用域、只能移除。想"允许一部分"要用 `restrict` 的 allow 语义或换缝，不要硬塞进 `guard`。

**5 提示词段**：每轮都付费。加之前先问：这条规则能不能变成工具描述、配置默认值或 `guard`？能就不是提示词问题。

**6 替换实现**：唯一会**同时影响所有消费方**的层。动手前读 `07-official-plugin-anatomy.md` 的检查单；契约里最容易被忽略的三样是**事件模式**（`@mode`）、**返回形状**、**disposer 行为**。

**7 客户端 slot**：只渲染 React 组件，不 iframe、不 `require` 客户端包、不在组件外写 DOM。组件抛错会把整个 slot 搞白。

## 反模式与它们的症状

| 反模式 | 你会看到 |
|---|---|
| waterfall 里忘了 `next()` | 官方行为莫名消失，日志里什么都没有 |
| 用 `inject` 声明了可选服务 | 对方没装时你的插件根本不启动 |
| 在自己上下文里造平行注册表 | 别人的 agent 看不到你的贡献 |
| 跨 context 注册但不留 disposer | 卸载后幽灵注册，热更后翻倍 |
| 靠加载顺序而非 `inject` | 冷启动偶发失败，热重载必坏 |
| 用新 `type` 追加会话事件 | 会话打不开（`append` 写不出 `ignorable`） |
