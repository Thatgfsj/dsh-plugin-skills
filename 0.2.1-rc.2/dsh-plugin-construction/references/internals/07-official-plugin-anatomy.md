# 07 官方插件解剖：要重构它们，先知道它们靠什么站着

来源：`dsh-v0.2.1-rc.2` 源码树 `packages/**`、各包 README、`docs/capability-seams.md`（生成）。本篇给**结构性事实**与**替换检查单**；具体实现请读对应 `src/index.ts`。

## 官方包的统一骨架

    packages/<group>/<pkg>/
      package.json         # dsh 字段声明角色；peer + dev 成对声明共享实例
      src/
        index.ts           # 入口：导出 name / inject / Config / apply，或 default 服务类
        types.ts           # 公开类型与 declare module 扩展
        <feature>.ts       # 按能力拆分，一个文件一件事
      src/client/          # 仅有浏览器半边的包（ui-*）
      locale/              # en.json / zh.json，展示与文案
      tests/               # 包级测试；注册类贡献要验"卸载后确实消失"

包内依赖方向是**单向**的：`index.ts` 组装服务，具体能力在兄弟文件里；`types.ts` 不 import 实现。你要替换一个包时，**先看 `types.ts`**——那里是契约，`index.ts` 只是装配。

## 四个样本

### `core/tools`（10 个源文件，约 5.8k 行）—— 注册表 + 受控流水线的范式

- 服务键 `ctx.tools`；事件 `tools/change`（`emit`）、`tools/pre-execute` / `tools/execute` / `tools/post-execute` / `tools/result`（`waterfall`，可见源码里 `@mode` 标注 2 条 emit、4 条 waterfall）。
- 拆分方式：`schema.ts`（参数方言与校验）、`presentation.ts`（面向模型的呈现）、`ptc.ts` / `ptc-calls.ts`（程序化工具调用）、`json-schema.ts`、`testing.ts`（测试替身）、`types.ts`。
- **要替换它**，必须同时满足：同样的 `register`/`restrict`/`guard` 语义、同样的四个 waterfall 模式、`defineTool` 的校验与 `output.render` 约定、`tools/change` 的广播时机。少一样就会有消费方静默错。

### `core/session`（10 个源文件）—— 追加日志 + 版本迁移的范式

- 服务键 `ctx.sessions`；核心概念：`SessionEvent`、`deriveMessages()`、`append` 与 `ignorable`、`fork` / `repair` / `surface` / `request-header` / `seq-ranges` / `tool-history` 分文件。
- 契约里最容易踩的三点：**信封形状**（`ignorable` 只能由受控 API 写出）、**版本选择**（`session.vN.jsonl` 只能新增不能改写）、**工具历史补记**（失败 step 要补缺失结果）。
- **要替换它**，先读 `docs/subsystems/session.md` 与 `docs/session-format-status.md`；会话格式是**用户数据**，破坏它等于让别人的历史打不开。

### `skill/skill`（单文件 868 行）—— 服务 + provider 注册的范式

- 服务键 `ctx.skills`；`register(skill)` 单参数、`source`/`content` 必填；`registerProvider(create)` 收工厂；`runtime` 是保留提供方名；同名 `register` 先到先得+警告，提供方重名直接抛错。
- 它同时是**契约的教科书**：能力定义在 `skill` 包，本地实现放在 `skill-filesystem`，消费方在 `tool-skill`——三层分得干干净净。要加一种技能来源，就实现一个 provider，不要动 `ctx.skills`。

### `client/ui-plugin-manager`（15 个源文件，含 `src/client/`）—— Host/Client 双半边的范式

- 服务键 `pluginRegistryProbe`（客户端侧服务），负责把 Host 的注册表响应与浏览器侧对照。
- 结构上 `src/index.ts` 是 Host 半边，`src/client/` 是浏览器半边，共用 `locale/`。两侧通过 RPC/流通信，**不共享 JS 内存**。
- **要替换它**，两侧契约都要满足；只在 Host 侧改会导致浏览器拿不到数据但页面不报错。

## 重构/替换检查单（动手前逐条打勾）

**契约层**

- [ ] 服务键名不变，且 `declare module` 类型扩展完整（否则消费方类型报错、运行时可能静默）
- [ ] 每个事件的**名字 + 派发模式**不变（`@mode` 标注要一致）；`waterfall` 的 `next()` 语义不变
- [ ] 公开方法签名、返回形状、错误类型不变；同步/异步属性不变
- [ ] 配置 schema 的字段名、默认值、`.volatile()` 语义不变（否则设置卡片与热更行为变）
- [ ] 注册/卸载语义不变：注册返回 disposer，卸载后贡献确实消失

**行为层**

- [ ] 幂等与顺序：重复注册、并发卸载、热重载后的状态
- [ ] 失败姿态与官方一致（fail-open 还是 fail-closed），诊断可观测
- [ ] 会话/持久化相关的写路径不产生新 `type`、不破坏版本选择
- [ ] token 成本不显著上升（工具描述、提示词段）

**工程层**

- [ ] `engines.dsh` 覆盖你要支持的运行时（它一旦存在就单独决定兼容性，见 `../plugin-package.md`）
- [ ] 共享实例的 `@deepseek-ai/*` 在 `peerDependencies` + `devDependencies`
- [ ] 包级测试覆盖"卸载后贡献消失"与"契约形状"
- [ ] 迁移说明：旧键/旧事件名要不要保留别名，保留多久

## 一条经验

官方包之所以"看起来难替换"，通常不是实现复杂，而是**契约藏在 README 与 `types.ts` 里、没写在函数注释上**。所以顺序永远是：读 `types.ts` → 读 README 的契约段 → 读 `index.ts` 的装配 → 最后才看实现细节。
