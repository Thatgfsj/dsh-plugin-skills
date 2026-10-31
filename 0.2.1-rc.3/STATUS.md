# 0.2.1-rc.3 — 静态分析

> **状态：静态分析，未在本机运行时验证。** 本目录内容由 tag `dsh-v0.2.1-rc.3` 的源码与官方文档差分整理；标为「已实测」的结论来自 0.2.1-rc.2 的运行时验证。

## 分析基线

| 项 | 值 |
|---|---|
| tag | `dsh-v0.2.1-rc.3` |
| 与上一版关系 | 上一版目录 `0.2.1-rc.2`（有运行时验证） |
| 源码包数 | 343（rc.2 为 342） |
| 服务 / 事件 / slot（源码口径） | 110 / 88 / 80（rc.2 同口径 110 / 88 / 77） |

## 插件作者相关面：无改动

逐字节比对下列文件，rc.2 → rc.3 **零差异**：

- `packages/util/package-manifest/src/types.ts`（`dsh` 字段、`icon`、`engines`）
- `packages/boot/app-boot/src/plugin-compatibility.ts`（兼容门）
- `packages/boot/app-boot/src/package-meta.ts`（展示元数据、图标、子路径）
- `packages/client/modules/src/index.ts`（客户端组合）
- `packages/skill/skill/src/index.ts`（技能注册）
- `packages/core/tools/src/schema.ts`（`defineTool` 参数方言）

所以 `references/` 里的契约类结论对本版仍然适用——但这是**差分推断**，不是运行时实测。

## 官方文档变更

| 类型 | 文件 |
|---|---|
| 新增升级指南 | `docs/upgrade-guide/v0.2.1-rc.2/new-session-blank-reuse/`（New Session 复用空白会话，属会话行为，非插件契约） |
| 修改 | `docs/user/guide/providers.md` |
| 生成文档 | `config-catalog.md`、`event-producer-consumer.md`、`module-graph.md`、`subsystems/slots.md` |

slot 数从 77 增到 80 与 UI 改动一致（`client/ui-*`）。

## 变更热点（源码）

`client/ui-conversation`、`client/ui-sidebar`、`client/ui-sidebar-right`、`client/ui-primitives`、`llm/llm-deepseek*`、`sdk/server`、`preset/agent-preset`、`extensions/*`。

## 未验证项

- 全部运行时行为（本机仍是 0.2.1-rc.2，未升级）
- `internals/generated/` 的四张表来自**源码树**，口径与安装产物不同（源码含未随包分发的包），数字不能与 rc.2 目录的安装版表直接比
- 新增 slot 的具体用途未逐一确认

## 怎么变成「已验证」

在安装了 0.2.1-rc.3 的机器上：`node scripts/dsh-map.mjs`（不带 `--source`）重新生成、逐条复核 `references/` 中受影响的结论，然后把本文件状态改为已验证。