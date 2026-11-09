# 0.2.1-rc.5 — 静态分析

> **状态：静态分析，未在本机运行时验证。** 内容基于 tag `dsh-v0.2.1-rc.5` 与上一版 `0.2.1-rc.4` 的差分整理；标为"已实测"的结论来自 0.2.1-rc.2 的运行时验证。

## 分析基线

| 项 | 值 |
|---|---|
| tag | `dsh-v0.2.1-rc.5` |
| 与上一版关系 | `0.2.1-rc.4`（同为静态分析） |
| 源码包数 | 343（与 rc.4 相同） |
| 服务 / 事件 / slot（源码口径） | 110 / 88 / 80（与 rc.4 相同） |
| 本机运行时 | 0.2.2-rc.1（**未**在 rc.5 上运行） |

## 插件作者相关面：契约无改动

逐字节比对下列文件，rc.4 → rc.5 **零差异**：

- `packages/util/package-manifest/src/types.ts`（`dsh` 字段、`icon`、`engines`）
- `packages/boot/app-boot/src/plugin-compatibility.ts`（兼容门）
- `packages/boot/app-boot/src/package-meta.ts`（展示元数据、图标、子路径）
- `packages/client/modules/src/index.ts`（客户端组合）
- `packages/skill/skill/src/index.ts`（技能注册）
- `packages/core/tools/src/schema.ts`（`defineTool` 参数方言）

所以 `references/` 里的契约类结论对本版仍然适用——但这是**差分推断**，不是运行时实测。

## 官方文档变更

新增升级指南 **`docs/upgrade-guide/v0.2.1-rc.4/reasoning-body-props/`**（目录名用 rc.4，首次随 rc.5 发布）。对插件作者的影响：

- `conversation.chat.reasoning.body` slot 的 owner props **新增 `rawText`**（原始模型输出），`text` 改为 Chat 处理后的**显示文本**，`running` 不变；
- `conversation.chat.reasoning.content` Factory 入参仍是 `text` / `running` / 可选 `labels`；
- 自定义推理渲染器与翻译包装组件需要迁移：要完整模型输出就读 `rawText`，显示继续用 `text`。

## 变更热点（源码）

rc.4 → rc.5 共 **368 个改动文件，其中 349 个是 `package.json`**（版本号同步），diff 文件数偏高主要来自这里。真正落到源码的改动集中在：

- `packages/client/ui-chat`：reasoning 渲染（`ReasoningContent.tsx`、`ReasoningRow.tsx`、新增 `reasoning-text.ts`、`contract/slots.ts`、`conversation-nodes/process-activity.ts`）与对应测试
- `packages/experimental/client-ui-cot-translation`：`TranslationBody.tsx` 与测试
- `packages/extensions/cordis-client-runner`：`slot-catalog.ts` 的源码行号/说明同步
- `apps/web/tests/reasoning-preview.e2e.ts`

其余包（`web/*`、`workspace`、`workflow` 等）的改动同样只是版本号，**不是行为改动**。

## 未验证项

- 全部运行时行为（本机没有 0.2.1-rc.5 运行时）
- `internals/generated/` 的四张表来自**源码树**，口径与安装产物不同（源码含未随包分发的包）
- reasoning-body-props 迁移在真实流式/完成态与翻译视图下的渲染未验证

## 怎么变成「已验证」

在安装了 0.2.1-rc.5 的机器上：`node scripts/dsh-map.mjs`（不带 `--source`）重新生成、逐条复核 `references/` 中受影响的结论，然后把本文件状态改为已验证。
