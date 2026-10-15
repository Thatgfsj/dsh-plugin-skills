# Host 插件契约

来源：官方 `docs/user/develop/{basic,framework}/*.zh.md`、`packages/AGENTS.md`、随 dsh 安装的 `cordis-plugin-development` 技能；行为结论已在本机 0.2.0-rc.2 上实测。

## 三种导出形态（不要混用）

```js
// 1. 函数插件（最常用）
export const name = 'my-plugin'
export const inject = ['tools']            // 可选：声明的服务就绪后才执行 apply
export const Config = Schema.object({...}) // 可选：Schemastery schema
export function apply(ctx, config) {}
```

```js
// 2. 对象形式
export default { name: 'my-plugin', inject: ['tools'], apply(ctx) {} }
```

```js
// 3. 服务类（对外提供能力时）
export default class Metrics extends Service {
  static inject = ['llm']
  constructor(ctx) { super(ctx, 'metrics') }
}
```

**函数插件不要加 default 导出**：混用会让 Loader 丢掉函数插件的命名空间（官方 postmortem 0001）。服务类用默认导出。

提供服务的插件还要做类型声明合并，消费方才有 `ctx.metrics` 的类型：

```ts
declare module '@deepseek-ai/cordis' {
  interface Context { metrics: MetricsService }
}
```

## 生命周期与清理

Fiber 状态机：`PENDING → LOADING → ACTIVE`，失败进 `FAILED`，`ACTIVE → UNLOADING → DISPOSED`。

- 声明 `inject` 的插件会**等依赖就绪**才执行 `apply`；依赖服务消失时自动 dispose，恢复后自动重载。
- **注册即 effect**：`ctx.on()`、`ctx.tools.register()`、`ctx.skills.register()`、`ctx.effect(fn)` 全部自动清理，`fn` 返回的 disposer 在卸载时调用。不要手写 removeListener / clearInterval。
- 卸载时 disposer 按注册逆序**开始**调用，但多个异步 disposer 并发，**不保证逐个完成**。有顺序依赖的清理要放进同一个 `ctx.effect()` 的返回函数里串行等待。
- `ctx.plugin(child)` 建子 Fiber，随父卸载。

实测（本机）：插件 `apply` 里 `console.log` + `ctx.effect` 注册，`dsh --profile web --patch <overlay> --help` 启动后依次打印 loaded / registered / disposed。

## 配置：Config

```ts
export interface Config { greeting: string; maxRetries: number }
export const Config: Schema<Config> = Schema.object({
  greeting: Schema.string().default('Hello'),
  maxRetries: Schema.number().default(3),
})
export function apply(ctx: Context, config: Config) {}
```

- **必须导出 Schemastery schema**，不要导出普通对象：Cordis 要求 Standard Schema 接口。
- 校验发生在插件加载时，非法配置**加载失败并给明确错误**。
- 硬性约定：**凡是不同部署可能取不同值的参数都必须是配置字段**。检验标准是"能不能只改 `cordis.yml` 就改掉这个值"。
- 实时生效字段用 `.volatile()` 标记；只改 volatile 值时 Loader 走 `loader/volatile-update` 原地换快照，**不会重跑 `apply`**，所以读值要用引用 `config.x.get()`。命名空间与 profile 里的行 `id` 绑定，改 `id` 会静默孤儿化设置卡片。
- 实测：row 的 `config` 会作为第二个参数传入，未给的字段由 schema 默认值补齐（`config={"greeting":"hi"}`）。

## 服务与依赖

- `inject = ['tools']` → `apply` 里可安全用 `ctx.tools`。
- **未声明的 `ctx.<name>` 会抛错**（源码文案：`cannot get property "${prop}" without inject`）。实测里该行后续输出全部消失；但"有没有日志"取决于 Loader 的日志级别，不要把它当成"必然无声"。
- `ctx.get(name, strict = true)` **不要求 `inject`**（cordis 源码注释原话：*without the inject requirement*）；默认 `strict` 下只返回**已激活 fiber** 的实现，否则返回 `undefined`。因此"未声明 `inject` 时读不到 `tools`"这个现象更可能是**读得太早、提供方 fiber 还没 ACTIVE**，而不是 `inject` 决定可见性——别据此给可选依赖乱加 `inject`。读不到时按「提供方未激活 → 作用域隔离 → 真的不存在」顺序排查。
- **拓扑敏感**：`@deepseek-ai/dsh-*` 这类包必须放 `peerDependencies`（见 `references/plugin-package.md`），否则 import 直接失败。

## 事件

| 模式 | 语义 |
|---|---|
| `ctx.emit(name, payload)` | 广播，忽略返回值 |
| `ctx.bail(name, input)` | 顺序执行，第一个非 `null/false/undefined` 的返回值胜出 |
| `await ctx.serial(name, ctx)` | 顺序 + 等异步，同样短路 |
| `await ctx.waterfall(name, input, next)` | 流水线；监听器**必须调用 `next()`**，不调用即故意短路 |

- 事件命名约定 `namespace/action`（`agent/pre-step`、`tools/result`、`session/event` …）。
- `turn/*`、`step/*`、`tool/call`、`tool/result`、`compaction/*` 是**持久化会话事件类型**，不是同名 Cordis 事件；要观察它们请监听 `session/event` 再看 `event.type`。
- 改写 `agent/pre-step` 决策时要**展开**（`{ ...decision, messages }`），否则 `startsRequestSeries` 之类的字段会丢。
- 类型：用 `declare module '@deepseek-ai/cordis' { interface Events { 'my/event': (p: P) => void } }`。

## 工具（defineTool）

```ts
import { defineTool } from '@deepseek-ai/dsh-tools'

export const inject = ['tools']
export function apply(ctx: Context) {
  ctx.tools.register(defineTool({
    name: 'greet',
    description: 'Greet someone by name.',
    parameters: { name: { type: 'string', required: true, description: 'The name to greet' } },
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
    async execute(args) { return `Hello, ${args.name}!` },
  }))
}
```

- `parameters` 是 DSH 自己的方言，**不是 JSON Schema**；`defineTool` 据此推导并校验 `args`。
- `execute` 只返回 `output.schema` 声明的**规范值**；面向模型的内容由 `output.render` 生成。
- 尊重 `exec.signal`；耗时任务走 `ctx.jobs`；presenter 必须纯函数（无 I/O、时钟、随机）。
- 权限/策略用 `ctx.tools.guard()`（只拒绝、同步）与 `ctx.tools.restrict()`（只移除、按 agent 作用域）；要变换结果才用 `tools/post-execute`，最终结果观测用 `tools/result`。

## 会话与状态（红线）

- **模型可见 ⟺ 已记录**：任何进入模型请求的东西都必须能从会话日志重建。
- **绝不用新的 `type` 追加密话事件**：读方只在信封带 `ignorable: true` 时接受未知类型，而运行时 `Session.append()` 写不了这个标记，写了会让**会话打不开**。把插件状态放进 storage 服务，或从既有事件推导。
- 每次会话的派生状态放 `ctx.sessionProjections`（`apply(state, event)` 纯同步、忽略即返回同引用），不要自己订阅 `session/event` 再全量扫描。
- 等持久事件（`turn/end`、`assistant/message`、`tool/result`），实时 token 读 `agent/assistant-stream`；**不要轮询 `agent/status`**。
- 注册在别的 context（如 `agent.ctx`）上的东西有两个拥有者：自己也要在插件 effect 里留一份 disposer。

## 包级规范（写进自己仓库时照做）

- ESM (`"type": "module"`)，跨包用包名 import，同包相对路径带扩展名。
- 测试放包级 `tests/`；注册类贡献要有卸载后"注册确实消失"的验证。
- 配置字段、错误信息、README 契约与代码同一次改动内更新。
