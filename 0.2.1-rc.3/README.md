# 0.2.1-rc.3（待适配）

> 状态：**尚未适配**。这个目录目前只有状态说明，**没有**技能内容。

## 为什么空着

本仓库的规矩是：**只写在该运行时上核对过的结论**。0.2.1-rc.3 是 npm `next` 通道的新版本（`npm view @deepseek-ai/dsh dist-tags` 可见），但本机安装的仍是 `0.2.1-rc.2`，没有可验证的运行时，所以这里不放复制粘贴的旧内容——那样只会把"看起来对"的东西混进来。

## 适配清单

1. **安装该运行时**：`npm i -g @deepseek-ai/dsh@0.2.1-rc.3`，确认 `dsh --version` 与目录名一致。
2. **取对应 tag 的文档**：
   ```sh
   git clone --depth 1 https://github.com/deepseek-ai/deepseek-harness /tmp/dsh-src
   cd /tmp/dsh-src && git fetch --depth 1 origin \
     refs/tags/dsh-v0.2.1-rc.3:refs/tags/dsh-v0.2.1-rc.3
   git archive dsh-v0.2.1-rc.3 | tar -x -C /tmp/dsh-021rc3
   ```
3. **先读破坏性变更**：`docs/upgrade-guide/<版本>/**`，逐条判断影响哪些结论。
4. **从上一版复制起点**：`cp -R 0.2.1-rc.2/dsh-plugin-construction 0.2.1-rc.3/`（另一个技能同理），然后**逐条重验**，不是改版本号。
5. **重新生成事实表**：`node scripts/dsh-map.mjs`（默认写到当前运行时版本对应的目录）。
6. **验证**：
   ```sh
   node scripts/validate-skills.mjs
   node scripts/dsh-map.mjs --check
   ```
7. **只保留验证过的内容**：核不动的条目要么删掉，要么在 `sources.md` 的"未验证"一节写明。

## 准入条件

- [ ] `dsh --version` 与目录名一致
- [ ] `scripts/dsh-map.mjs` 生成的四张表来自该运行时
- [ ] 每条硬结论写明了适用的版本与来源
- [ ] `validate-skills.mjs` 与 `dsh-map --check` 均通过

## 上一个版本

已适配完成的版本在 [../0.2.1-rc.2/](../0.2.1-rc.2/)。