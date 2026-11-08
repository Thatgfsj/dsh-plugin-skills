# 06 浏览器半边：客户端是怎么接上宿主的

来源：`docs/subsystems/{client-modules,slots,web-client,web,client-resources}.md`、`packages/client/AGENTS.md`、`packages/client/modules/README.md`。适用 **0.2.1-rc.2**。具体写法见 `../client-plugin.md`，本篇讲**它怎么运转**。

## 宿主与浏览器各管一半

    Host                                   Browser
    ─────────────────────────────────────  ──────────────────────────
    扫描 loader 条目                         加载 /plugins/<id> 的 bundle
    读每个包的 dsh.client 声明               执行脚本 → 只注册 factory
    compose 启动图（依赖边/顺序）            物化时才跑 factory(require)
    通过 /plugins 路由把 bundle 发出去        用平台模块表解析 react 等
    提供 RPC 与流                            组件挂进 slot 渲染

客户端组合发生在 **`ClientModuleRegistry` 构造期**，不是插件 `start` 阶段。构造期 compose 失败会抛 `ClientPackageCompositionError`；**之后**由 `internal/plugin` 事件驱动的重算，失败只走 `ctx.logger.warn`。这就是"我把 `dsh.client` 写坏了却什么都看不到"的原因——不是没跑，是错误被降级了。

## 一条客户端插件的完整链路

1. 包在 `package.json` 声明 `dsh.client: { platform: 'web', ... }` 并导出 `./client`。
2. Host 侧的 `clientModules` 扫到它，把 `client.js` 变成 `/plugins/<id>` 可取的 bundle，并把它排进启动图。
3. 浏览器取到脚本，执行时**只调用** `window.__ModuleLoader__.load({ id, factory })` 注册工厂。
4. 首次有人 `require` 它时，`factory(require)` 才跑；所以 CSS 注入、事件订阅等副作用都发生在**物化**时，不是加载时。
5. 返回的对象是 `{ inject: ['slots'], apply(ctx) }` —— 客户端也有自己的 Cordis 上下文与服务。
6. `apply` 里通过 `ctx.slots.inject(ownerKey, () => ctx.slots.register(...))` 把组件挂到具体位置。

## slot 模型

- 每个 slot 有一个 `ownerKey`；owner 塌缩时注册被回收，恢复时重装。
- 注册即声明：某个 `name` 的注册条目成为唯一被允许渲染该键的条目；注册未声明的 slot、重复声明子 slot 会在加载时抛错。
- slot 清单随版本变（本机 0.2.1-rc.2 是 100 个，见 `generated/slots.md`）。**不要硬编码清单，要 grep 或读生成表。**

## 客户端资源

- 文案走 Client locale 服务，样式用 `--dsw-alias-*` 主题 token；字面颜色只给插画本身。
- 主题切换不重载插件，所以组件必须响应式取 token，不要在模块顶层读一次存起来。
- 文档/文件预览有专门的资源消费者（`useResource`）；需要读资源时用注入的 hook，不要自己实现一份 fetch/cache。

## 三条边界

1. **不要 `require` 任何 `@deepseek-ai/dsh-client-*` 包**：它们在 `dsh.client.inject` 里只是**排序依赖**，不是可复用 API；版本一变就碎，且纯 JS 没有类型检查。
2. **不要 iframe**：拿不到主题 token、明暗切换与 `ctx.locale`。
3. **组件抛错会白掉整个 slot**，控制台只会有一行 `slot entry crashed in '<slot>'`。给用户可见的组件加错误边界是必要的。

## 验证边界（重要）

`dsh --patch <overlay> --help` 能验证 Host 半边，也能证明客户端**组合**跑过了（插一个 `inject: ['clientModules']` 的探针会打印激活），但**看不到渲染**。渲染问题必须真实页面：浏览器控制台无 slot crash、明暗各看一次、与同类型官方组件并排比。
