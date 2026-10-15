# Web UI 客户端插件

浏览器半边由 `@deepseek-ai/dsh-client-modules` 负责：宿主侧扫描已启用的 Loader 条目、把每个包的 `dsh.client` 声明变成 `/plugins` 下的 bundle，浏览器侧惰性加载。**模型看不到这一层。**

## 最小可用的客户端包

`package.json`：

```json
{
  "name": "@local/my-decoration",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./index.js",
    "./client": "./client.js",
    "./package.json": "./package.json",
    "./locale/*.json": "./locale/*.json"
  },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": { "platform": "web", "immediately": true,
                "inject": ["@deepseek-ai/dsh-client-ui-conversation"] }
  }
}
```

> **只要包里有 `exports`，就必须显式导出 `"./package.json"` 与 `"./locale/*.json"`。** 宿主用 `<pkg>/package.json` 和 `<pkg>/locale/<lang>.json` 两个子路径读展示信息；`exports` 存在但没列出它们时解析抛 `ERR_PACKAGE_PATH_NOT_EXPORTED`，被 `missingResource()` 吞掉——**不报错、无诊断**，图标与标题静默回退到默认插画和包名/description。实测参照：`dsh-dream-skin` 的 `exports` 显式包含这两个子路径。

`cordis.patch.yml`：`insert` 一行，`name` 写包名（浏览器行的 `id` = 包名 = `client.js` 里注册的 `id`，三者必须一致）。

`index.js`：Host 半边可以什么都不做，`export function apply() {}`。

`client.js`：

```js
window.__ModuleLoader__.load({
  id: '@local/my-decoration',                 // 必须等于包名
  factory(require) {
    const React = require('react')            // 从平台模块表拿，不要自带 React/CDN/UMD
    const h = React.createElement
    function Decoration() {
      return h('div', { style: { opacity: 0.6 } }, 'hello')
    }
    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock', id: 'my-decoration', order: 5,
        }, Decoration))
      },
    }
  },
})
```

## 加载协议（已对源码核实）

- 执行 bundle 脚本**只注册 factory**；模块体副作用（含 CSS 注入）在物化时（`factory(require)`）才跑。factory 保持无副作用。
- 解析顺序：平台 seed 表 → 已记忆记录 → 启动图 row → 已注册 factory → 否则**抛错**。同步 `require` 走同一顺序但不等动态图 row。
- 包声明了 `dsh.client`、`platform === "web"` 却**没有 `./client` 导出**会在组合期抛错（源码文案：`declares dsh.client but exports no "./client" bundle`；非 web 平台直接被忽略，不抛）。
- `dsh.client.external` 只用于基座之外的精确模块请求（含 `<pkg>/client` 这类子路径）；纯类型 import 会被擦除。组合期会拒绝畸形请求、缺失提供方、自请求与同步请求环。
- DSH 自家包走 tsdown 构建，产物是 `lib/client.js`；**第三方普通 JS 包直接把 export 指向 `client.js` 即可，不需要构建**。

## Slot 注册

- `ctx.slots.inject(ownerKey, () => ctx.slots.register(options, Component))`：owner 塌缩时注册被回收，恢复时重装。
- 注册即声明：注册条目成为唯一被允许渲染该键的条目；注册未声明 slot、重复声明子 slot 等会在加载时抛错。
- 几个实测存在于本机 0.2.0-rc.2 的 slot id：`conversation.composer.dock`、`conversation.composer.bar`、`conversation.input.dock`、`conversation.input.left`、`conversation.input.overlay`、`conversation.header`、`conversation.chat.node`、`conversation.chat.turnTail`。`shell.overlay` 只在确实需要覆盖层且位置已知时用。
- **查真实 slot 名不要靠记忆**：在已安装的包上跑 `grep -rho "slots\.inject('[^']*'" <profile>/node_modules/@deepseek-ai/*/lib/*.js | sort -u`；带 inspection 工具（如 `cordis_inspect_query`）的会话可以直接查 `Slots.listSubTree`，没有就靠 grep。

## 硬性 UI 规则

- 用宿主主题 token（`--dsw-alias-*`）做容器与控件；字面颜色只用于插画本身。token 改名最多让外观退化，不会让渲染崩掉。
- **不要 `require` 任何 `@deepseek-ai/dsh-client-*` 包**（`dsh.client.inject` 里的条目只用于排序激活）。它们随时会变，纯 JS 插件没有类型检查，组件抛错会把整个 slot 搞白（控制台 `slot entry crashed in '<slot>'`）。要复刻控件就照抄 markup/CSS/行为并加自己的类名前缀。
- 不要 iframe 托管页面（拿不到主题 token、明暗切换、`ctx.locale`）；不要替换 app root；不要在组件外写 DOM、不要往 `document.body` 追加。
- 面向用户的文案走 Client locale 服务；资源在 `apply` 里用 `ctx.effect`/`ctx.on` 注册并返回清理函数，组件级样式以 React 元素形式渲染以便卸载时移除。
- 加 Chat 行：用 `ctx.uiConversation.events.register()` 注册事件定义，视图注册到 `conversation.chat.node` slot 下、键为定义里的 `kind`。

## 展示元数据（本机 0.2.0-rc.2 的正确写法）

```json
// locale/en.json（可加 locale/zh.json；同名字段）
{ "meta": { "title": "My Decoration", "description": "Draws a badge under the composer." } }
```

```json
// package.json —— 图标是顶层字段，不是 exports 里的 "./icon"
{
  "icon": "./icon.svg",
  "exports": { "./package.json": "./package.json", "./locale/*.json": "./locale/*.json" }
}
```

- 缺字段会回退到 `package.json` 的 `name`/`description` 与面板默认插画；元数据畸形只产生诊断并保留有效文本。
- 子路径插件（`my-plugins/search`）不是包，**不读 `package.json`**。
- 参照实现：`dsh-dream-skin@10.15.0`（真实第三方 UI 插件）——`dsh.bundle.patch` + `dsh.client{platform,immediately,inject}`，`exports` 里 `./client` → `lib/client.js`，顶层 `icon`，`locale/en.json` 与 `locale/zh.json`。

## 验证的边界（重要）

- 客户端组合发生在**插件的 start 阶段**。实测：`dsh --profile <p> --help` 只跑到 `apply`，把 `dsh.client.platform` 改成非法值、或把 `./client` 指向不存在的文件，**都不报错**。所以这条路径只能验证 Host 半边。
- UI 半边必须靠**真实提供出来的页面**（浏览器控制台无 slot crash、明暗主题各看一次、与同类型宿主组件并排比对）才能下结论。没有浏览器控制时，只能声明"已完成语法、manifest、slot 层级检查，渲染未验证"，**不要**用 mock 页面截图充当验证。
- 改了客户端 bundle 需要重新构建并刷新页面；HMR 会用带 revision 的 URL 重载，但**替换已安装的包必须重启**才能换到新的 JS 模块代。
