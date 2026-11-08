# 0.2.2-rc.1 — 已实测（本机运行时）

> 本目录对应本机安装的 `dsh 0.2.2-rc.1`，关键结论已在运行时验证；事实表由**安装产物**生成。

## 实测项

| 项 | 结果 |
|---|---|
| `dsh --version` | `0.2.2-rc.1` |
| 安装产物体量 | 330 个 `@deepseek-ai/*` 子包（0.2.1-rc.4 源码树 343） |
| 事实表（安装口径） | 330 包 / **112 服务** / **102 事件** / **109 slot**（0.2.1-rc.2 为 305/104/94/100） |
| 插件加载冒烟 | `dsh --profile web --patch <overlay> --help`：`apply` 执行、`config` 传入、`ctx.effect` 注册与释放均正常 |
| 组合层 | `--dump-config` 输出 52 条 `# ==` 层注释 |
| `engines.dsh` 兼容门 | 仍强制：`engines.dsh: ">99.0.0"` → `installation rejected ... requirements {"engines.dsh":">99.0.0"}` + `nothing was installed` |
| `dsh plugin --help` | 仍打自己的帮助（不是 pnpm 的） |
| 新增清单字段 | 安装产物类型定义里确认 `optionalDependencies`、`dsh.bundle.platforms`、`dsh.bundle.listedByDefault` |

## 0.2.1 → 0.2.2 的破坏性变更（本次已写进 references）

1. **补丁与 Include 的写入语义**（Loader 1.0.0-rc.8 / Include 1.1.1）：`applyEntryPatches` 总返回克隆；`EntryTree.write()` 移除；Include 用 journal、文件编辑优先、运行期改动写回父 patch；**patch 插入的行在运行期的自我修改不跨重启保留**。
2. **session projection**：帧形状改为每事件一帧含 `changes`；`snapshot()` 只算请求单元；`cachedSnapshot` 弃用；新增 `onEventChanged`；释放的 key 变 predecessor。
3. **清单字段**：`optionalDependencies`、`dsh.bundle.platforms`、`dsh.bundle.listedByDefault`。
4. **客户端资源**：活动客户端包走带内容修订的 `./assets/*` 导出。
5. **文件工具策略默认关闭**：`fs-observation-policy` 以 `disabled: true` 出厂，`write`/`edit` 不再强制"先读后写"，新增 `apply_patch`（base 系 profile 的 `tool-fs` 与 Web `standard` preset 启用）。

## 未验证项

- 真实 UI 渲染（无浏览器控制）；客户端组合只在 `--help` 下确认为"已 compose"。
- Include journal 的冲突/写回行为只读了升级指南，没构造双写冲突实测。
- `apply_patch` 的实际行为未跑。