# 09 自己验证：把"听说"变成"我看到了"

适用 **0.2.1-rc.2**。这份技能的每条结论都应该能被你复现；复现不了就不要信，包括我写的。

## 先定位你机器上的 dsh

    dsh --version                                   # 运行时版本，一切结论的锚点
    npm root -g                                     # 全局包根
    ls "$(npm root -g)/@deepseek-ai/dsh/node_modules/@deepseek-ai" | wc -l   # 子包数（本机 305）

安装产物路径：`<npm root -g>/@deepseek-ai/dsh/node_modules/@deepseek-ai/<pkg>/`。**读源码就看这里**，不要凭记忆。

## 三把不启动的刀

    dsh --profile <p> --dump-config          # 最终 entry 列表 + 层名注释
    dsh --profile <p> --dump-config-schema   # 行/补丁 JSON Schema
    dsh --profile <p> --dump-default-config  # 去掉用户层与 --patch 的骨架

`--dump-config` 里三个必查点：`# == <层名>` 是否出现、目标 `id` 是否存在、有没有 `patch: entry "x" not found`。

## 秒级冒烟：让插件真的跑起来

    cat > /tmp/overlay.yml <<'YAML'
    - insert:
        - id: probe
          name: '/tmp/probe.mjs'
          config: { hello: 1 }
    YAML

    cat > /tmp/probe.mjs <<'JS'
    export function apply(ctx, config) {
      console.log('[probe] apply', JSON.stringify(config))
      ctx.effect(() => { console.log('[probe] effect on'); return () => console.log('[probe] effect off') })
    }
    JS

    dsh --profile web --patch /tmp/overlay.yml --help

预期：`apply` 打印、effect 注册、Usage 输出、effect 释放。这条路径**不绑端口**，可以放心跑。

## 想查某个能力到底谁提供

    # 服务键 → 归属包
    grep -rhoP 'super\(ctx, "\K[^"]+' "$(npm root -g)/@deepseek-ai/dsh/node_modules/@deepseek-ai"/*/lib/index.js | sort -u

    # 事件名 → 谁派发
    grep -rhoE 'ctx\.(emit|bail|serial|waterfall|parallel)\(\s*"[a-z][a-z0-9-]*/[a-z0-9-]+"' <pkg>/lib/*.js | sort -u

    # 客户端 slot
    INBOX="$(npm root -g)/@deepseek-ai/dsh/node_modules/@deepseek-ai"
    PROFILE="$HOME/.dsh/profiles/<profile>/node_modules"
    grep -rhoE "slots[.]inject\((['\"])" "$INBOX"/*/lib/*.js "$PROFILE"/*/*/lib/*.js 2>/dev/null | wc -l

或者直接跑本仓库的生成器，一次拿四张表：

    node scripts/dsh-map.mjs           # 写入 references/internals/generated/
    node scripts/dsh-map.mjs --check   # 过期则报错（发布前跑）

## 上游文档怎么看

安装包里**没有** `docs/`。要读官方文档，按 tag 取源码：

    git clone --depth 1 https://github.com/deepseek-ai/deepseek-harness /tmp/dsh-src
    cd /tmp/dsh-src && git fetch --depth 1 origin refs/tags/dsh-v0.2.1-rc.2:refs/tags/dsh-v0.2.1-rc.2
    git archive dsh-v0.2.1-rc.2 | tar -x -C /tmp/dsh-021rc2

**必须对 tag，不要看 master**——今天 master 的行为可能已经是下一版了。

常用入口：

| 想知道 | 读 |
|---|---|
| 整体架构、turn 流程 | `docs/architecture.md` |
| Cordis 概念 | `docs/cordis-primer.md` |
| 某个子系统 | `docs/subsystems/<name>.md` |
| 服务/依赖图 | `docs/capability-seams.md`、`docs/module-graph.md`（生成） |
| 术语 | `docs/glossary.md` |
| 破坏性变更 | `docs/upgrade-guide/<版本>/<主题>/guide.md` |
| 某个包 | `packages/<group>/<pkg>/README.md` |

## 怎么判断一条结论过期了

1. 版本号对不上 → 直接当过期。
2. 引用的文件/行号在当前安装里找不到 → 过期。
3. `node scripts/dsh-map.mjs --check` 报 drift → 生成表过期。
4. 官方有更新的 `upgrade-guide` 条目 → 优先信它。

## 不要做的事

- 不要用 master 文档验证旧版本的结论，反之亦然。
- 不要把 `--help` 冒烟的"没报错"当成"UI 没问题"（客户端渲染验证不到）。
- 不要把"我看日志没输出"当成"没执行"（错误可能走 `ctx.logger.warn` 而不是 stdout）。
- 不要在没读过 `types.ts` 的情况下替换官方实现。
