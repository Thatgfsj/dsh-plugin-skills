# 03 运行时：一次 turn 到底发生了什么

来源：`docs/architecture.md`（Events / Turn flow / Session log）、`docs/agent-lifecycle.md`、`docs/subsystems/{core,session,session-projection,tools,system-prompt}.md`。适用 **0.2.1-rc.2**。

## 两个单位

- **step** = 一次模型请求 + 它触发的工具调用。
- **turn** = 零个或多个 step：在第一条输入被 claim 之前打开，在"没有欠账"时关闭。

理解这两个词，才能理解 `turn/start` 与 `step/start` 为什么是不同层的事件。

## 主链路（省略细节，保留钩子）

    turn/start
      claim 下一步输入 + 一条排队消息
      assemble 提示词段 + 工具 schema
      → agent/pre-step            [waterfall] 可拒绝 / 可改写（改写给 startsRequestSeries）
         拒绝或首次改写为空 → 不产生 step，直接收尾
      step/start
      → agent/request             [waterfall] 解析实际路由（此时取消则 system 与 users 都不提交）
         重算 system/message，追加 user/message，冻结模型历史
      流式请求 → llm/stream       [waterfall] → agent/assistant-stream 起/块/止
         assistant/message | assistant/attempt
      tool/call* → tools/pre-execute → tools/execute → tools/post-execute → tool/result*
      step/end
      还有欠账或新输入 → 回到 claim
      → agent/turn-stopping       [serial，无 next]
    turn/end

## 三类事件，选错就是设计错误

| 类别 | 例子 | 存续 | 什么时候用 |
|---|---|---|---|
| **会话事件**（持久） | `turn/*`、`step/*`、`user/message`、`assistant/message`、`assistant/attempt`、`tool/*` | 写进追加日志，重载后还在 | 这个事实必须活过重启 |
| **agent 事件**（活体） | `agent/pre-step`、`agent/request`、`agent/assistant-stream`、`agent/turn-stopping` | 进程内，携带活的 `Agent` | 观察或拦截**正在飞**的工作 |
| **能力事件**（策略/适配） | `fs/*`、`tools/*`、`telemetry/*` | 进程内 | 给某个缝挂策略或适配器，不想 import 循环 |

持久事件通过 `session/event` 广播；要观察它们请监听 `session/event` 再看 `event.type`，而不是找同名 Cordis 事件。

## 会话日志是唯一事实源

- 模型看到的历史由 `deriveMessages()` 从日志投影出来。**模型可见 ⟺ 已记录**。
- `assistant/message` 内嵌产生它的完整流；`assistant/attempt` 保存失败/重试/取消/流出错的尝试，但不进模型历史。
- `agent/assistant-stream` 只服务实时 UI；进程硬崩在落盘之前，这段流**不会**变成持久事实。
- 派生状态放 `ctx.sessionProjections`（纯同步、忽略即返回同引用），不要自己订阅 `session/event` 再全量扫。

## 工具环

    tools/pre-execute  [waterfall]  观察/改写参数、短路
    tools/execute      [waterfall]  真正执行
    tools/post-execute [waterfall]  变换结果
    tool/result                     持久化结果

- `ctx.tools.guard()`：同步、只能拒绝；`ctx.tools.restrict()`：按 agent 作用域、只能移除。两者是"策略"最便宜的落点。
- 工具 schema 由 `defineTool()` 从 DSH 自己的参数方言推导（**不是 JSON Schema**）；`execute` 只返回 `output.schema` 的规范值，面向模型的内容由 `output.render` 生成。
- 工具失败不会让 step 静默结束：循环会补记缺失的工具结果。

## 提示词是"节点"，不是一个大字符串

`system/message` 是持久会话事件，提示词以历史节点的形式存在：

- 空渲染会清空所有活动的 system 节点（旧提示词对模型不可见）。
- 支持的路线会在缓存历史之后**追加**非空更新；不支持的路线在新请求系列开始时合并。
- 所以"我只想改一段提示词"的正确做法是注册**提示词段**，而不是替换整块 system/message（`05-extension-seams.md` 有代价对比）。

## 一次 turn 里可以插手的六个位置

| 位置 | 机制 | 能做什么 | 风险 |
|---|---|---|---|
| 输入被接受前 | `agent/pre-step` | 拒绝、改写、标记新请求系列 | 改写必须展开对象，否则丢字段 |
| 路由/请求前 | `agent/request` | 换模型、改能力 | 取消语义要自己想清 |
| 提示词 | `ctx.systemPrompt` 段注册 | 加一段说明/规则 | 每轮都花 token |
| 工具可见性 | `ctx.tools.restrict` / `ctx.tools.register` | 收窄或扩展工具面 | 收窄可能让 agent 无法完成任务 |
| 工具执行 | `tools/guard` / `tools/pre-execute` | 拒绝或改参数 | 同步 API，不能做慢操作 |
| 落盘后 | `session/event` 监听 / projections | 统计、派生状态 | 别在监听器里做重活 |

## 一个反直觉点

`agent/pre-step` 之后，组装**不会**因为重试而重跑；重试只会刷新已注册的运行时事实。所以把"每次请求都要重算"的逻辑放进 `agent/request` 或提示词段的求值里，不要放在 `apply` 里吃一次性的快照。
