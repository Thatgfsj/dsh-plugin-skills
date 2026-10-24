# DSH 内部结构索引

> 版本基线：**dsh 0.2.1-rc.2**（本机安装版本）。这里每条结论都绑定该版本；升级后先跑 `node scripts/dsh-map.mjs --check`，再按 `sources.md` 的纪律重验。

## 为什么有这一层

`../SKILL.md` 教的是"怎么做一个插件"。这一层回答更靠前的问题：**DSH 是怎么运转的**。不知道骨架，做插件只能抄样例；知道骨架，才能判断"我这个需求应该插在哪一层、代价多大、会不会和官方实现打架"。

三类读者，三条路径（不要从头读到尾）：

| 我要做什么 | 读这些（按顺序） |
|---|---|
| 写一个新插件 | `05-extension-seams.md` → `01-substrate-cordis.md` → `08-design-playbook.md` |
| **重构/替换官方插件** | `07-official-plugin-anatomy.md` → `02-boot-composition.md` → `03-agent-runtime.md` → `05-extension-seams.md` |
| 排查"没反应 / 升级后坏了" | `09-reading-source.md` → `02-boot-composition.md` → `04-service-map.md` |
| 想先建立整体印象 | 本文件 → `02-boot-composition.md` → `03-agent-runtime.md` |

## 篇章

| 文件 | 讲什么 | 读它的时机 |
|---|---|---|
| `01-substrate-cordis.md` | 基底 Cordis：Context / Service / Fiber / effect / scope / 五种派发 | 不理解 `inject` 到底在干什么、为什么注册要回收时 |
| `02-boot-composition.md` | 启动链路：CLI → profile → bundle → patch 层 → loader → fiber 树 | 想知道"我这一行是什么时候、被谁、以什么顺序挂上去的"时 |
| `03-agent-runtime.md` | 一次 turn 的完整数据流：输入 → 提示词 → LLM → 工具环 → 会话日志 | 要介入模型行为、工具调用、上下文时 |
| `04-service-map.md` | 104 个服务按键的家族图与用途 | 找"这个能力归谁、我该 inject 谁"时 |
| `05-extension-seams.md` | 扩展缝阶梯：从最弱到最强，每种的代价与观测性 | **动手前必读**，决定插哪一层 |
| `06-ui-layer.md` | 浏览器半边：client modules、slots、RPC、资源 | 要做 UI 时 |
| `07-official-plugin-anatomy.md` | 官方插件解剖 + 重构检查单 | 要重写/替换官方实现时 |
| `08-design-playbook.md` | 从基底搭插件的最佳实践与反模式 | 设计评审、自查时 |
| `09-reading-source.md` | 本机定位与验证配方（grep、dump、版本判定） | 任何一条结论想自己复核时 |

## 机器生成的事实

`generated/` 下的四张表由 `scripts/dsh-map.mjs` 从**已安装的 dsh** 直接读出来，不要手改：

| 表 | 内容 | 现规模 |
|---|---|---|
| `generated/services.md` | 每个 `ctx.<name>` 句柄、归属包、源码行号 | 104 |
| `generated/events.md` | 事件契约名、**派发模式**、声明方、派发方 | 94 |
| `generated/slots.md` | 客户端 slot id 与触碰它的包 | 100 |
| `generated/packages.md` | 全部随包分发的包与清单角色 | 305 |

手写篇章负责**解释**，生成表负责**事实**。两者冲突时以生成表和安装产物为准。

## 事实纪律

- 每条硬结论都写了它在 `ds-v0.2.1-rc.2` 里对应哪个文件/文档；对不上就是过期了。
- 上游原文用路径引用，不整段搬运：`docs/architecture.md`、`docs/cordis-primer.md`、`docs/subsystems/<name>.md`、`packages/<group>/<pkg>/README.md`。
- 无法实测的部分明确写"未验证"，不要用推断填补。
