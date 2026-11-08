# 01 基底：Cordis 是怎么托住整个 DSH 的

来源：`docs/cordis-primer.md`（全文）、`vendor/cordis/src/{reflect,fiber,events}.ts`、`docs/subsystems/scope.md`。适用 **dsh 0.2.1-rc.2**（vendored cordis 4.0.5）。

## 五句话

1. **插件是实现了 Service 的对象**：要么是带可选 `inject` 与 `apply(ctx)` 的函数，要么是 `Service` 子类。
2. **上下文是服务仓库**：服务占一个稳定的 `ctx.<key>`（`ctx.tools`、`ctx.llm`、`ctx.sessions`…），别人按 key 找能力，**不 import 具体实现**。
3. **依赖靠 `inject` 声明**：声明了就等对方就绪再 `apply`。所以"加载顺序"不是启动脚本排的，是需求关系推出来的。
4. **通信靠带类型的 Event**：事件名用 TypeScript 声明合并注册，派发方式由契约决定。
5. **注册即 effect**：提示词段、工具 schema、适配器、监听器都通过 `ctx.effect()` / `ctx.on()` 安装，卸载时自动回滚。

这五条决定了整个 DSH 的形状：**没有特权内核可以打补丁**，模型适配器、工具注册表、会话日志、agent 循环本身都是插件，都能被配置替换。

## 五种派发方式（选错就是 bug）

| 模式 | 是否 await | 顺序 | 有返回值 | 用途 |
|---|---|---|---|---|
| `emit` | 否 | 注册顺序 | 无 | 纯广播：有人想知道，但没人能否决 |
| `waterfall` | 否 | 注册顺序 | 有 | 环绕中间件：改写/短路 |
| `parallel` | 是 | 全并发 | 无 | 扇出：多个独立副作用 |
| `serial` | 是 | 注册顺序 | 有 | 有序判定 |
| `bail` | 否 | 注册顺序，遇值即停 | 有 | 一票否决 |

`waterfall` 的语义最容易写错：监听器收到 `(...args, next)`，**必须调 `next()` 才算交棒**；不调就是故意短路。只做观察或加注的监听器**必须** `next()`，否则你会悄悄吃掉下游所有人的决策。单决策事件（如 `agent/pre-step`）里，拥有决策权的监听器才该短路。

`tools/*`、`agent/pre-step`、`agent/request`、`llm/stream` 都是 waterfall —— 这就是为什么"我加了个监听器，结果官方行为没了"通常不是 bug，而是忘了 `next()`。

## Fiber 状态机：一个插件的生命周期

`PENDING → LOADING → ACTIVE → UNLOADING → DISPOSED`，失败走 `FAILED`。

- `inject` 声明的服务消失 → 该插件自动 dispose；服务回来 → 自动重载。这正是"热插拔"的实现方式，也解释了为什么有些插件在别的插件卸载后会**突然自己重启**。
- **同步阶段抛错**会让这一行直接失败；异步阶段抛错要走 `ctx.logger.error` 才看得见（否则表现为"这行不存在"）。
- 卸载时 disposer 按注册逆序**开始**调用，但多个异步 disposer **并发**，不保证逐个完成。有顺序依赖的清理必须放进**同一个** `ctx.effect()` 的返回函数里串行等待。

## `ctx.get` 与 `ctx.<service>` 不是一回事

- `ctx.tools`（属性访问）要求本插件 `inject` 里声明过 `tools`，否则抛 `cannot get property "tools" without inject`。
- `ctx.get('tools')` **不要求 inject**，但默认 `strict = true`：只返回**已激活**的实现，否则 `undefined`。
- 推论：`ctx.get` 返回 `undefined` ≠ 服务不存在，可能只是**读得太早**。给可选依赖乱加 `inject` 会让你的插件在对方没装时**根本起不来**。

## 作用域与隔离

- `inject` 决定"什么时候能跑"；**scope** 决定"看到哪一层"。DSH 用 `dsh-scope` 给每个 agent 维护一层作用域注册链（近层覆盖远层）。
- 同一个服务键可以有多份实现，谁赢由**层序 + 作用域**决定。这就是为什么 `ctx.skills` / `ctx.tools` 能在子 agent 里有一份不同视图。
- 想给某个子树换实现，用 `ctx.isolate(...)` 进隔离域，而不是去改全局。

## 服务可以被"换掉"，但不能被"假装"

配置文件里同一行 `id` 被上层 patch 覆盖后，`ctx.<key>` 指向**新的实现**，消费方代码一行不用改。这是 DSH 可替换性的来源，也带来两个必须知道的后果：

1. 新实现必须满足**同一份契约**（方法、事件名、事件模式、返回形状），否则所有消费方一起坏。
2. 官方实现常在 README 里写明契约细节；换实现前把它们当验收标准（见 `07-official-plugin-anatomy.md`）。

## 作者视角的四条硬规矩

- 行为**封装进插件**：工具流水线事件属于 `ctx.tools`，模型流属于 `ctx.llm`，实时 agent 协作属于 `ctx.agents`。别在自己的私有上下文里造平行体系。
- 拦截与策略优先用**事件**；直接调用能力优先用**服务方法**。
- 每个注册都要有 disposer（自己返回，或用帮你还原的 helper）。
- 需要"只在这个 agent 里生效"的东西，用作用域注册，不要用全局变量式写法。
