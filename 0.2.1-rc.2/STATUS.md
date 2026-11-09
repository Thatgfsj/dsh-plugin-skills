# 0.2.1-rc.2 — 历史记录（本机运行时实测）

> **状态：历史。** 本目录对应当时本机安装的 `dsh 0.2.1-rc.2`，是这套技能第一次在运行时逐条复核的版本；当前推荐版本见 `0.2.2-rc.1/STATUS.md`。

## 分析基线

| 项 | 值 |
|---|---|
| `dsh --version` | `0.2.1-rc.2`（2026-10 采样，npm `next` 通道） |
| 安装产物体量 | **305** 个 `@deepseek-ai/*` 子包 |
| 事实表（安装口径） | 305 包 / 104 服务 / 94 事件 / 100 slot |
| vendored cordis | 4.0.5 |

## 备注

- 取证过程、实测清单与当轮审查记录见 [dsh-plugin-construction/references/sources.md](dsh-plugin-construction/references/sources.md)。
- 本目录正文的基线仍然是 0.2.1-rc.2：**不要**把这里的实测数字当成当前版本的结论；跨版本差异见 `0.2.2-rc.1/dsh-plugin-construction/references/sources.md`。
