# 04 服务地图：104 个 `ctx.<name>` 按键的家族图

事实来源：`generated/services.md`（由 `scripts/dsh-map.mjs` 从已安装 dsh 生成，含归属包与源码行号）。本文件只做**家族归类与用途注解**，逐条明细以生成表为准。

## 怎么用这张地图

1. 先想清楚你要的能力属于哪个**家族**（下表）。
2. 去 `generated/services.md` 查确切键名与归属包。
3. 用 `inject` 声明它；**不要** `import` 它的实现包（那会锁死版本）。
4. 想看它定义了哪些事件，去 `generated/events.md` 按包名反查。

## 家族

### 核心脊柱（换掉任何一个都等于换掉半个 DSH）

| 键 | 归属 | 一句话 |
|---|---|---|
| `sessions` | `dsh-session` | 追加日志与内存存储；`deriveMessages` 的来源 |
| `systemPrompt` | `dsh-system-prompt` | 提示词段与工具 schema 的组装 |
| `tools` | `dsh-tools` | 带作用域的工具注册表与受控执行流水线 |
| `agents` | `dsh-agent` | `Agent` 接口、活体注册表、`agent/*` 事件 |
| `agentLoop` | `dsh-agent-loop` | 实现该接口的默认驱动器（turn/step 真正跑在这里） |
| `llm` | `dsh-llm` | 消息与流词汇 + 适配器缝 |
| `sessionProjections` | `dsh-session-projection` | 派生状态（纯同步 `apply(state,event)`） |

### 引导与组合

`pluginPackages`（`app-boot`）、`pluginManager`、`pluginInventory`、`pluginMarket`、`profileContext`、`hmr`、`cordisInspect`、`dynamicCordisRunner`。

### 会话周边

`sessionQuery`、`sessionProjectionCache`、`sessionPersistence`、`sessionTitle`、`sessionTelemetry`、`sessionReferenceResolver`、`sessionController`（API 侧）、`sessionSkillCatalog`。

### 能力缝（可替换的实现）

`fs`、`shell`、`shellEnv`、`sandbox`、`sandboxPolicy`、`approval`、`authorization`、`permissionPresets`、`credentials`、`storage`、`spillStore`、`jobs`、`schedule`、`goals`、`planMode`、`skills`、`commands`、`attachments`、`subagents`、`ptcRuntime`、`mcpResources`、`officeToPdf`、`speechToText`。

### 模型与计量

`llm`、`modelDirectories`、`deepseekAccount`、`deepseekLlmApiExtensions`、`productTelemetry`、`otel`、`messageFeedback`。

### 浏览器半边（只在客户端上下文里存在）

`clientModules`、`slots`、`connection`、`conversation`、`configForms`、`settingsSchema`、`commandUi`、`shortcuts`、`inputTriggers`、`fileUpload`/`fileUploads`、`modelDirectories`、`productAnalytics`、`pluginRegistryProbe`。

### API / 控制器（Web 与桌面共用）

`remote`、`remoteAccess`、`agentPresets`、`agentTeams`、`accountController`、`credentialsController`、`settingsController`、`sessionController`、`jobController`、`directoryPicker`/`directoryPickerController`、`speechController`、`sessionFileReferences`、`fileReferences`。

## 三条使用纪律

1. **键是契约，不是提示**。`ctx.tools` 的语义由 `dsh-tools` 的 README 定义；你换实现就要满足它（见 `07-official-plugin-anatomy.md`）。
2. **能不 inject 就不 inject**。声明的依赖会参与激活判定：对方没装或失败，你的插件就不启动。`ctx.get()` 适合"有就用、没有就降级"的场景。
3. **别抢官方的键**。想加能力就新开一个 `ctx.<yourKey>`；抢占 `ctx.tools` 之类的键会与官方实现互相覆盖，且没有明显报错。

## 生成表怎么读

`generated/services.md` 的 `also implemented by` 列值得单独看：同一个键有多个实现包时，说明它是**被设计成可替换**的（能力缝）；只有一列时通常是脊柱服务。`source` 列给的是 `super(ctx, "<key>")` 的确切位置，怀疑行为时直接跳过去读。
