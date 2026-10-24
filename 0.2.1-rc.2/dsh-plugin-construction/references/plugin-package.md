# package.json 的 dsh 字段、bundle 与 profile

事实来源：本机 `@deepseek-ai/dsh-package-manifest/lib/types/types.d.ts`（**0.2.1-rc.2**，已读源码）+ 官方 tag `dsh-v0.2.1-rc.2` 的 `docs/user/develop/basic/publish.md`、`packages/boot/app-boot/README.md`。字段名与可选性以类型定义为准。

## 顶层声明（`DshPackageManifest`）

| 字段 | 含义 |
|---|---|
| `name` / `version` | 必填 |
| `description` | 展示与发现用 |
| `icon` | **SVG/PNG/JPEG/WebP，相对本 manifest，realpath 后必须落在包内，≤256 KiB** |
| `private` | 本 profile 项目等不发布场景 |
| `engines.dsh` | SemVer 区间。**0.2.1 起被真正强制，且优先于 peer**：声明了它就由它**单独**判定兼容性，peer 被忽略（见下文「版本兼容门」）。类型定义仍写着 *declarative until a reader enforces it* —— 而现在安装器与 profile 启动**就是**那个 reader |
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

- **bundle**：附带配置层的包。用户装它 = 得到一个 patch 层。装完 `dsh.profile.bundles` 会**自动对齐**：解析到声明了 `dsh.bundle.patch` 的依赖就入栈，没有声明的依赖保持普通依赖并打一条一次性警告（实测原文：`declares no dsh.bundle — installed as a plain dependency, not a profile layer`），移除依赖则离栈。所以 `update` 后新增的声明也会自动生效。
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
- 覆盖一个不存在的 `id` 会被**跳过并警告**：实测 `dsh: [<patch 路径>] patch: entry "no-such-row-xyz" not found`。注意这条**只在 `--dump-config` 输出**，`--help` 冒烟下看不到——升级上游后务必专门跑一次 `--dump-config`。
- `group: true` + `name: cordis:group` 让 `config` 变成嵌套行列表；`cordis:include` 从 `config.path` 读 YAML/JSON 列表。

## 依赖解析（link 安装最容易踩）

官方 `publish.md` 的规则，实测已确认：

- 需要与宿主**共享实例**的 dsh 包（`@deepseek-ai/dsh-*`、`@deepseek-ai/cordis`、`@deepseek-ai/schemastery`）声明在 **`peerDependencies` + `devDependencies`**：peer 让运行时用宿主那份，devDependency 给类型检查和独立测试。
- **一处真实分歧**：官方仓库内部包的约束脚本把 `@deepseek-ai/schemastery` 归进 `dependencies`（理由：它是运行时校验器，仓库内靠 workspace 解析，不存在实例不一致）。**这个例外只对 monorepo 内部包成立**；对外部 link 安装的第三方插件，实测不声明 peer 会直接 `ERR_MODULE_NOT_FOUND`。照 `publish.md` 的 peer 规则走更安全——关键是**必须声明**，声明在别处会引入第二份实例。
- 独立版本的第三方依赖、无状态的 dsh 工具包放 `dependencies`。
- **反例实测**：`index.js` 里 `import Schema from '@deepseek-ai/schemastery'`，包只 link 进 profile、没声明 peer → `ERR_MODULE_NOT_FOUND`（直接用 node 从该目录 import 也是同样错误），插件行**静默不加载**；把该包加进 `peerDependencies` 后同一份代码正常加载。
- **为什么非 peer 不可**（0.2.1-rc.2 实测三连）：在 dsh 安装目录里 `import('@deepseek-ai/schemastery')` **成功**（宿主那份在这儿），但从**插件自己的目录**和**profile 目录**都失败：`ERR_MODULE_NOT_FOUND: Cannot find package '@deepseek-ai/schemastery'`。所以宿主共享的包不能靠"运行时总能找到"，必须声明成 peer 让解析走到宿主那份——**声明错了不是报错，是整行没反应**。

## 版本兼容门

`dsh plugin add` 在 pnpm 运行前检查，**也适用于 profile 启动时对每个已声明 bundle 的复检**。判定顺序（0.2.1-rc.2 源码 + 实测双重确认）：

1. 清单里有 `engines.dsh` → **只看它**，`@deepseek-ai/dsh` 与 `@deepseek-ai/dsh-*` 的 `peerDependencies` 全部忽略。
2. 没有 `engines.dsh` → 每个 dsh peer 区间都必须匹配。
3. 两者都没有 → 不设约束。

边界条件：空区间或非法区间、`engines.dsh` 里的 `workspace:` 值、`engines` 不是对象、`engines.dsh` 不是字符串 —— 一律按不兼容/畸形处理。预发布版本参与区间匹配。这道门**只防版本错配，不是恶意代码沙箱**。

拒绝时安装器打印（实测原文）：

```
dsh: installation rejected: Plugin bundled-demo@1.0.0 is incompatible with dsh 0.2.1-rc.2: requirements {"engines.dsh":">99.0.0"}. Running it may cause crashes or data loss. Update the plugin or install a plugin version compatible with this dsh runtime. ...
dsh: nothing was installed.
```

注意键名是 **`requirements`**（0.2.0-rc.2 时代叫 `peers`）：`engines.dsh` 规则下键为 `engines.dsh`，peer 回退时键为具体的包名。

「接受风险」的提示是 **CLI 另外加的一行**，给的是可直接复制的命令：

```
dsh: to accept the risk, run: dsh plugin --profile <p> allow-version <pkg@ver> --dsh-version <ver> --accept-risk
```

绕过（`allow-version`，按**精确版本**豁免）等于承认可能崩溃或丢数据，只在用户明确同意后使用。失败时还会打印 `dsh: plugin command failed; diagnostics: <profile>/.plugin-manager/logs/operation-*/pnpm.log`，那是查安装错误的入口。

## 分发形态与代价

| 形态 | 用户需要批准构建脚本吗 | 备注 |
|---|---|---|
| 本地目录 / link | 否 | `files` 不过滤 link 目录，改完即生效（但 JS 模块代需要重启才会换新） |
| tarball（`pnpm pack`） | 否 | 推荐给不想让用户授权的场景 |
| npm 预构建 | 否 | 发布前构建好 `lib/` |
| `github:you/repo` | **是**（构建脚本批准） | 拉的是源码不是产物；作者必须提供自包含的 `prepare` 脚本，用户要显式允许该包在安装时执行代码，且应锁 commit。dsh 侧已核实会把批准写进 profile 的 `pnpm-workspace.yaml` 的 `allowBuilds`；「pnpm ≥10」这个版本归属**没核对**（本机 pnpm 12.11.2） |
