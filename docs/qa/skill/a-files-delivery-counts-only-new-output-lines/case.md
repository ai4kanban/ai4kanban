# 不用 Git 工作树的卡片：交付只认这次新加的 Output 行

## Setup

- **项目**：`/tmp` 下一次性 git 项目，根目录有 `template.md`；`akb install` 新装，删掉初始卡 #1 和 `setup-checklist.md`。
- **工作流**：`akb workflow duplicate coding` 复制出 `wf-2`，再 `akb workflow worktree wf-2 off`：直接在项目里交付文件，不建分支。
- **卡片**：#2、#3 用 [body.md](body.md)（一条规划待办 ``Write `out/email/index.html` from `template.md` ``）；#4 用 [body-pages.md](body-pages.md)，仿 #1923：先写初稿 `drafts/v1.html`，再导出 `out/pages/page-4x5-*.png`；#5 用 [body-old-output.md](body-old-output.md)，卡上已有一条之前交付留下的 `` - [x] Output: `./out/email/` ``。
- **Agent**：[stand-in.mjs](stand-in.mjs) 顶替 Claude Code（看板 `ui.config.json` 的 `harnessSettings.claude-code.command`）：先执行 `akb card implement <id> --print` 读流程，再写文件、勾待办。#2 另加一行 Output，#3、#5 不加；#4 第一次只勾初稿和通配符两条待办并删掉 `drafts/`，第二次才加 `` - [x] Output: `./out/pages/` ``。
- **复现**：[run.sh](run.sh) 用本次提交构建的 CLI 从头建项目并跑完全部步骤。

## Steps

1. 建好工作流和四张卡。
   `wf-2` 标着 `(no worktree)`；#2 的待办只有那一条未勾选的规划待办。
   [01-setup.log](01-setup.log)

2. 执行 `akb card implement 2`。
   起一次 `implement` 运行，属于一次新交付。
   [02-implement.log](02-implement.log)

3. 看运行里的 agent 读到的收尾流程。
   第 1 条是「add one new ticked `## Todo` line naming the output file or folder, never a wildcard, such as `` - [x] Output: `./out/email/` ``」；不再有「不改计划待办措辞」那一条。
   [03-flow.log](03-flow.log)

4. 运行结束后看 `akb run list`、卡片、交付状态和 git。
   运行 ✓ done；#2 已归档，待办里是改了字的规划待办加 `Output: ./out/email/` 一行；交付 `finished`；git 没有新提交，只有 `main`。
   [04-archived.log](04-archived.log)

5. 对 #3 执行 `akb card implement 3`（同样改了字，但不加 Output 行），运行结束后再看。
   运行同样 ✓ done，但 #3 留在 `todo/`；交付停下，原因是 `the card records no output file`，`paths` 为空。
   [05-no-output.log](05-no-output.log)

6. 对 #4 执行 `akb card implement 4`：agent 勾掉初稿和通配符两条待办，删掉初稿，不加 Output 行。
   #4 留在 `todo/`；`drafts/` 已不存在；交付停下，原因是 `the card records no output file`，`paths` 为空——没有把已删的 `drafts/v1.html` 和通配符 `page-4x5-*.png` 报成缺失。
   [06-pages-first-build.log](06-pages-first-build.log)

7. 再对 #4 执行一次 `akb card implement 4`：agent 只新加 `` - [x] Output: `./out/pages/` ``。
   沿用同一次交付；#4 已归档，交付 `finished`——指向一个现有文件夹的 Output 行就够了，第一次勾掉的待办不再算成品。
   [07-pages-second-build.log](07-pages-second-build.log)

8. 对 #5 执行 `akb card implement 5`：卡上原有那条 Output 行不动，agent 不新加。
   #5 留在 `todo/`；交付的 `planned` 里记着原有的 Output 行；交付停下，原因是 `the card records no output file`——之前交付的 Output 行不算这次的成品。
   [08-earlier-output.log](08-earlier-output.log)

## Feedback

- **#1923 那种卡死没了**：分阶段制稿时删掉的初稿、文件名里的通配符，只要不写在 Output 行里就不会被检查，第二次执行补一行 Output 就收尾。
- **规则更简单**：收尾流程只剩「新加一行 Output，写文件或文件夹，不要通配符」，不用再记「别改计划待办措辞」。
- **补一行就能续上**：停下的交付再执行一次就接着走，不会另起一次交付。
- **停下的原因不够具体**：#4、#5 都只说 `the card records no output file`；#5 卡上明明有 Output 行，用户读这句会以为看板没认出来，不会想到要「新加」一行。
- **命令行看不出停下了**：停下的交付在 `akb run list` 里仍是绿色 ✓ done，卡片默默留在 `todo/`；原因只在看板界面（`sessions.json`）里。
- **流程措辞对运行不准**：运行里读到的收尾标题是「no run is watching this one finish」，而这正是一次被看板盯着收尾的运行。
- **没有跑到的**：真实 Claude Code 是否照新流程写 Output 行；看板界面里停下的交付长什么样（属 local-ui 模块）。
