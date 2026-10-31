# 0.2.1-rc.4 — 静态分析

> **状态：静态分析，未在本机运行时验证。** 内容基于 tag `dsh-v0.2.1-rc.4` 与上一版 `0.2.1-rc.3` 的差分。

## 分析基线

| 项 | 值 |
|---|---|
| tag | `dsh-v0.2.1-rc.4` |
| 源码包数 | 343（与 rc.3 相同） |
| 服务 / 事件 / slot（源码口径） | 110 / 88 / 80（与 rc.3 相同） |

## 官方文档：零变更

`docs/**`（非中文）与 rc.3 逐字节相同：**没有**新增升级指南，也没有修改既有文档。本版对使用者来说是纯代码修正。

## 插件作者相关面：无改动

与 rc.3 一样，下列文件逐字节无差异：`package-manifest/src/types.ts`、`app-boot/src/{plugin-compatibility,package-meta}.ts`、`client/modules/src/index.ts`、`skill/skill/src/index.ts`、`core/tools/src/schema.ts`。

因此插件契约与 rc.3（以及 rc.2 的运行时结论）一致。

## 变更热点（源码）

- `mcp/mcp-client`、`mcp/mcp-resources`
- `web/*`：`web-search-exa`、`web-search-perplexity`、`web-search-deepseek`、`web-fetch-http`、`web-deepseek-api`、`web`、`tool-web`
- `workspace/workspace`、`workflow/*`（各一处）
- 大量 `package.json` 版本号同步（这也是 diff 文件数偏高的原因）

## 未验证项

- 全部运行时行为
- 生成表来自源码树（口径同 rc.3）
- MCP 与 web 工具的改动是否影响插件可用性，未实测