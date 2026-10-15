# package.json 的 dsh 字段、bundle 与 profile

事实来源：本机 `@deepseek-ai/dsh-package-manifest/lib/types/types.d.ts`（0.2.0-rc.2，已读源码）+ 官方 `docs/user/develop/basic/publish.md`。本节字段名与可选性以类型定义为准。

## 顶层声明（`DshPackageManifest`）

| 字段 | 含义 |
|---|---|
| `name` / `version` | 必填 |
| `description` | 展示与发现用 |
| `icon` | **SVG/PNG/JPEG/WebP，相对本 manifest，realpath 后必须落在包内，≤256 KiB** |
| `private` | 本 profile 项目等不发布场景 |
| `engines.dsh` | SemVer 区间，**声明性字段**（类型定义原话：*DSH compatibility is declarative until a reader enforces it*）。本机未观测到由它触发的安装/启动强制；真正强制的是 `peerDependencies` 范围检查（见下文「版本兼容门」） |
| `dsh` | 作者声明，见下 |

## `dsh` 下的三种角色（一个包可以同时声明多种）

```ts
dsh?: {
  manifestVersion?: 1
  bundle?:  { patch: string | string[] }   // 配置层：一个 patch 文件，或按序应用的列表
  profile?: { bundles?: string[] }          // profile：有序的组合包名列表
  client?:  {                                // 浏览器半边
    platform: string            // Web 消费方选 "web"
    inject?: string[]           // 包名依赖边（不是 Cordis 服务注入）
    immediately?: boolean       // 阶段一预取屏障；缺省走共享 application 批次
    external?: string[]         // 基座之外的精确模块请求，含子路径
  }
}
```

- **bundle**：附带配置层的包。用户装它 = 得到一个 patch 层。
- **profile**：`~/.dsh/profiles/<name>/package.json` 里的 `dsh.profile.bundles`，回答"这套组合由哪些 bundle 按什么顺序组成"。**profile 清单从不需要手写** —— `dsh plugin` 会创建并维护。
- **client**：只在包同时要被浏览器加载时需要，见 `references/client-plugin.md`。

## 层序（后应用者按行胜出）

1. profile 的 `dsh.profile.bundles` 列表，按列表顺序（`@deepseek-ai/dsh-base` 通常第一）
2. profile 自己的 `cordis.patch.yml`
3. `$DSH_HOME/cordis.patch.yml`（机器本地偏好）
4. 每个 `--patch <path>` overlay，按 argv 顺序

**patch 替换目标行的整个 `config`，不是深合并。** 两个推论：
- 你的 patch 可以按 `id` 覆盖前面层的行，但必须重述该行需要的每一个键。
- 用户可以在自己 profile 的 `cordis.patch.yml` 里覆盖你的行，所以默认值要给用户大概率会保留的那个。

## cordis.patch.yml 语法（Loader 方言）

```yaml
- insert:                      # 追加行；若 id 指向已有 group: true 的行，则插进它的 config 列表
    - id: my-plugin
      name: 'my-package'       # 包名；insert 里的相对路径按该 patch 文件所在目录解析
      config: {}
      # disabled: false        # 布尔 / null / !!js 表达式
      # inject: [myService]
      # intercept: [...]
      # isolate: { shell: true }
- id: some-existing-row        # 无 insert + 有 id = 覆盖该行
  config: {...}                # 整体替换
```

- `!!js`（双感叹号）是 Loader 表达式，写在 `config` 或 `disabled` 里；**`!js` 是错的**。写在 `config` 里的表达式在该行声明的注入激活之后、对它自己的 context 求值（`ctx.<service>`）。
- 覆盖一个不存在的 `id` 会**大声警告**：实测 `dsh: [<patch 路径>] patch: entry "no-such-row-xyz" not found`。升级上游后请跑一次 `--dump-config` 复查。
- `group: true` + `name: cordis:group` 让 `config` 变成嵌套行列表；`cordis:include` 从 `config.path` 读 YAML/JSON 列表。

## 依赖解析（link 安装最容易踩）

官方 `publish.md` 的规则，实测已确认：

- 需要与宿主**共享实例**的 dsh 包（`@deepseek-ai/dsh-*`、`@deepseek-ai/cordis`、`@deepseek-ai/schemastery`）声明在 **`peerDependencies` + `devDependencies`**：peer 让运行时用宿主那份，devDependency 给类型检查和独立测试。
- 独立版本的第三方依赖、无状态的 dsh 工具包放 `dependencies`。
- **反例实测**：`index.js` 里 `import Schema from '@deepseek-ai/schemastery'`，包只 link 进 profile、没声明 peer → `ERR_MODULE_NOT_FOUND`（直接用 node 从该目录 import 也是同样错误），插件行**静默不加载**；把该包加进 `peerDependencies` 后同一份代码正常加载。

## 版本兼容门

`dsh plugin add` 在 pnpm 运行前检查：registry spec 会先查该范围选中的版本及其声明的 peer，**不兼容的 DSH peer 直接让操作失败**，不下载、不跑构建脚本。实测输出形态：

```
dsh: installation rejected: Plugin @deepseek-ai/dsh-web-app@0.0.1-rc.1 is incompatible with dsh 0.2.0-rc.2: peerDependencies {...}
dsh: nothing was installed.
dsh: to accept the risk, run: dsh plugin --profile <p> allow-version <pkg@ver> --dsh-version 0.2.0-rc.2 --accept-risk
```

绕过（`allow-version`）等于承认可能崩溃或丢数据，只在用户明确同意后使用。

## 分发形态与代价

| 形态 | 用户需要批准构建脚本吗 | 备注 |
|---|---|---|
| 本地目录 / link | 否 | `files` 不过滤 link 目录，改完即生效（但 JS 模块代需要重启才会换新） |
| tarball（`pnpm pack`） | 否 | 推荐给不想让用户授权的场景 |
| npm 预构建 | 否 | 发布前构建好 `lib/` |
| `github:you/repo` | **是**（pnpm ≥10 的 `allowBuilds`） | 拉的是源码不是产物；作者必须提供自包含的 `prepare` 脚本，用户要显式允许该包在安装时执行代码，且应锁 commit |
