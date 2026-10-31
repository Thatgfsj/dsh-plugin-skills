# 0.2.1-rc.3

> **静态分析版本**：内容基于 tag `dsh-v0.2.1-rc.3` 的源码与官方文档差分整理，**未在本机运行时验证**。分析记录见 [STATUS.md](STATUS.md)。

| 内容 | 说明 |
|---|---|
| [dsh-plugin-construction/](dsh-plugin-construction/SKILL.md) | 插件构建技能（结论来自 rc.2 的运行时验证 + 本版差分） |
| [dsh-skill-authoring/](dsh-skill-authoring/SKILL.md) | 技能编写技能 |

## 与上一版的关系

插件作者相关的六个核心源文件（manifest 类型、兼容门、展示元数据、客户端组合、技能注册、工具 schema）与 `0.2.1-rc.2` **逐字节相同**，因此契约类结论沿用；新增的只有会话行为（New Session 复用空白会话）与 UI 改动。

## 如何变成已验证

在装有 0.2.1-rc.3 的机器上 `node scripts/dsh-map.mjs`（不带 `--source`）重新生成事实表并逐条复核，然后把状态改写。