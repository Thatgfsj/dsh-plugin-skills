# 02 启动与组合：一行插件是怎么被挂上去的

来源：`docs/architecture.md`（Profiles and bundles / Application launch）、`packages/boot/app-boot/README.md`、`apps/cli/reference/README.md`、`docs/subsystems/boot.md`。适用 **0.2.1-rc.2**，其中"跳过/禁用"的文案为本机实测。

## 一条链，五段

    dsh --profile web
      └─ CLI 解析 launcher 参数（--profile / --patch / --dump-config…）
         └─ 定位 profile 目录：$DSH_HOME/profiles/<name>
            └─ 读 dsh.profile.bundles（有序）
               └─ 每个 bundle 的 dsh.bundle.patch 文件 → 按序拼成 patch 列表
                  └─ 再叠 profile 自己的 cordis.patch.yml
                     └─ 再叠 $DSH_HOME/cordis.patch.yml
                        └─ 再叠命令行 --patch 覆盖层（按 argv 顺序）
                           └─ Loader 把最终 entry 列表实例化成 fiber 树
                              └─ 插件按 inject 关系依次 ACTIVE

层序的口诀：**后应用者按行胜出**。一层 patch 要么 `insert` 新行，要么按 `id` 覆盖已有行（**整体替换 `config`，不深合并**）。

## entry 是什么

Loader 眼里的插件是**一行配置**：

    - id: my-plugin
      name: 'my-package'        # 解析到模块
      config: {...}             # 传给 apply 的第二个参数
      inject: [tools]           # 覆盖插件自己声明的依赖
      disabled: false           # 布尔 / null / !!js 表达式
      isolate: { shell: true }  # 隔离子树

`id` 是这行的身份，也是上层覆盖它时用的键；`name` 决定加载哪个模块。**同一 `id` 全树唯一**，覆盖靠它，排障也靠它。

## 启动期的三种"没起来"，含义完全不同

| 现象 | 发生在 | 你要查什么 |
|---|---|---|
| bundle 整层消失 | 组合期 | `dsh: skipping profile bundle "<name>": <warning>` —— 兼容门或 patch 读不出来 |
| 某一行被禁用 | 预检期 | `dsh: disabling profile plugin <label>: <warning>` —— 兼容门把它拿掉了 |
| 某一行静默不生效 | 实例化期 | import 解析失败、`inject` 永不满足、`apply` 抛错（error 级日志） |

**必需条目**（如 `agent-loop`、`webserver`、`web-runtime`、`modules`、`connection`）失败会让启动整体 dispose 并非零退出；非必需行失败只留一条警告，其余照常启动。这条差异决定你排障时先看退出码还是先看日志。

## 三把"不启动就能看"的刀

    dsh --profile <p> --dump-config          # 最终 entry 列表 + 每层注释（# == 层名）
    dsh --profile <p> --dump-config-schema   # 行/补丁的 JSON Schema，校验写法不用挂载
    dsh --profile <p> --dump-default-config  # 去掉用户层与 --patch 的骨架

`--dump-config` 里找三样东西：层名注释（谁贡献了这行）、目标 `id` 在不在、`patch: entry "x" not found`（陈旧覆盖）。**这条警告只在 `--dump-config` 输出**，`--help` 冒烟看不到。

## profile 是怎么被维护的

- 不要手写 profile 的 `package.json` / `cordis.patch.yml`。`dsh plugin` 会创建并维护。
- `dsh plugin --profile <p> add <spec>`：先做**版本兼容门**（`engines.dsh` 优先，否则 peer），再交给 pnpm，最后**对齐 `dsh.profile.bundles`**——声明了 `dsh.bundle.patch` 的依赖入栈，没声明的保持普通依赖并警告，移除依赖则离栈。
- 相对路径锚定**调用目录**，所以在插件仓库里 `add .` 装的就是当前 checkout。

## HMR 是层属性，不是全局开关

profile 组合里的 YAML 决定是否启用 `dsh-hmr`：`web` 模板开、`headless`/`sdk`/`acp` 关、`sdk-minimal` 根本不带。配置层可以覆盖这个默认。所以"为什么我改配置没热更"要先看当前 profile 的那一层。

## 对插件作者的含义

1. **你的插件永远是"叠在别人上面的一层"**，不是核心的一部分。设计时要假设上下都可能有人覆盖你。
2. **你 insert 的每一行都该有稳定 `id`**，否则用户没法在 profile 层改你的默认值。
3. **`config` 整体替换**：用户只想改一个键，也必须重述整行需要的所有键。这条要在你的 README 里写清楚。
4. **启动顺序不是你能承诺的**：靠 `inject` 表达依赖，不要靠"我比它先加载"。
