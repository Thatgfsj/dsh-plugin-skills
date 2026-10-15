# 安装、冒烟测试与排障

## 安装

```sh
dsh plugin --profile <name> add <目录绝对路径 | tarball | 包名 | github:you/repo>
dsh plugin --profile <name> remove <包名>
dsh --profile <name> --dump-config        # 看层，不启动
```

- `dsh plugin --profile <p> <args...>` 把 `<args>` 原样转发给**在 profile 目录里**执行的 pnpm，任何 pnpm 子命令都能用。
- 第一次使用会自动初始化 profile（`@deepseek-ai/dsh-base` 作为第一个 bundle），并在包声明了 `dsh.bundle` 时把它追加进 `dsh.profile.bundles`。
- 目录安装**不复制文件**（实测 `add <目录>` 约 40 ms 完成、不下载），**改完文件不需要重装**；但换新的 JS 模块代需要重启宿主。底层是 pnpm 的 link 行为：本机 `plugin-manager` 代码里没有 `link:` 这个字面量，我没做安装路径的直接验证。
- **不要手写 profile 的 `package.json`/`cordis.patch.yml`，不要在 profile 目录里跑 pnpm**（有 `plugin_manager` 工具的会话用 `action: install_bundle`；没有就用上面的 CLI）。

### in-box bundle 的一个坑（实测）

`@deepseek-ai/dsh-base`、`@deepseek-ai/dsh-web-app` 这类随 dsh 安装的 bundle，**写进 `dsh.profile.bundles` 时从 dsh 安装目录解析**（实测：手工往测试 profile 的 `bundles` 里加 `@deepseek-ai/dsh-web-app`，`--dump-config` 立刻出现该层，无需 pnpm）。

但 `dsh plugin add @deepseek-ai/dsh-web-app` 会去**公共 registry** 查版本，本机实测拿到的是过期的 `0.0.1-rc.1`，被兼容性检查直接拒绝：

```
dsh: installation rejected: Plugin @deepseek-ai/dsh-web-app@0.0.1-rc.1 is incompatible with dsh 0.2.0-rc.2 ...
dsh: nothing was installed.
```

结论：**不要用 `add` 装 in-box bundle**；要加就加到 `dsh.profile.bundles` 列表里。

## 三级验证阶梯

### 1）层与行（秒级，零副作用）

```sh
dsh --profile <p> --dump-config | grep -n '^# =='          # 层名
dsh --profile <p> --dump-config | grep -n '<你的行 id>'     # 行是否挂上
```

顺手复查陈旧覆盖：对不存在的 `id` 做 override 会打印
`dsh: [<patch 路径>] patch: entry "no-such-row-xyz" not found`（实测原文）。**这条警告只在 `--dump-config` 输出**：同一条 overlay 走 `--help` 时完全不会出现（实测）。

### 2）Host 半边真跑一次（秒级，零副作用）

```sh
# overlay.yml
# - insert:
#     - id: my-plugin
#       name: '/abs/path/to/index.js'
dsh --profile <p> --patch /abs/path/overlay.yml --help
```

用绝对路径把插件文件插进组合、给 app 传 `--help`：**组合会挂载、`apply` 会执行、stdout 会打印你的日志，Web 服务不会绑端口**。这是最快确认真实加载路径的方式。

**边界**：这条路径对 Host 半边足够，对 UI 半边不够。客户端组合其实**也会执行**——`ClientModuleRegistry` 在构造期就 compose 启动图，插一个 `inject: ['clientModules']` 的消费者能在 `--help` 输出里看到它激活；但事件驱动的 flush 把失败交给 `ctx.logger.warn`，所以把 `dsh.client.platform` 写成非法值、把 `./client` 指向不存在的文件时**看不到任何错误文本**。UI 半边必须用真实页面验证。

### 3）真实页面 / 端到端

装进 profile 后正常启动宿主，在页面上实际使用该能力。UI 要看：浏览器控制台无 slot crash、明暗主题各一次、与同类型宿主组件并排比对。改了 bundle 内容后重新构建并刷新。

## 排障表（按"主机上实测过"的顺序查）

| 症状 | 最可能的原因 | 怎么确认 |
|---|---|---|
| 装了但完全没反应，也没有任何报错 | 插件 import 了解析不到的包 | 从插件目录跑 `node -e "import('<包名>')"`；见下条 |
| `ERR_MODULE_NOT_FOUND` | 共享宿主实例的 `@deepseek-ai/*` 包没写进 `peerDependencies`（+ `devDependencies`） | 补上 peer 后重跑；实测补上即恢复 |
| `apply` 打印了第一行就没了 | 访问了未在 `inject` 声明的 `ctx.<service>`（属性代理会抛错） | 改成 `inject` 声明后重测；`ctx.get()` 返回 `undefined` 不等于服务不存在 |
| 覆盖别人的行没生效 | `config` 是整体替换；或上游已删该行 | `--dump-config` 里找 `patch: entry "<id>" not found` |
| 设置卡片不出现 | 命名空间 = profile 行 `id`；schema 必须是模块命名空间的属性；`describe()` 只显示有 `.volatile()` 字段的条目 | 检查行 `id` 与 `Config` 导出 |
| 安装被拒 | 安装期 peer 范围检查 | 报错里会给出 `allow-version` 的确切命令 |
| UI 组件把整个 slot 搞白 | 组件抛错，或 `require` 了 `@deepseek-ai/dsh-client-*` | 看浏览器控制台 `slot entry crashed in '<slot>'` |
| `git` 安装后加载失败 | 拉的是源码没有 `lib/`，且 `prepare` 没被批准 | profile 的 `pnpm-workspace.yaml` 里配 `allowBuilds` |

## 清理

用完的测试 profile 直接删目录即可（先确认绝对路径）：

```sh
rm -rf "$HOME/.dsh/profiles/<测试 profile 名>"
```

`dsh plugin remove <包>` 会同时移除依赖与对应的层。
