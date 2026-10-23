# 打开项目，skill 自动装好；只有出了问题，设置里才出现「安装」

## Setup

- **项目**：一次性 git 项目，`akb install` 建好看板后提交干净；项目里没有 `.claude/`、`.agents/`，也没有 `pre-commit` 钩子。
- **akb**：PATH 最前是这次构建的 `akb`（`akb --version` 输出当前版本）。
- **界面**：浏览器打开看板 UI（`kanban-ui`），窗口 1440×900，界面语言中文。这台机器装着 Claude Code，看板首次打开时的设置向导会选它。

## Steps

1. 打开看板之前，在终端看项目。
   `git status` 干净，没有 skill 文件夹和钩子。
   [打开之前](01-before.log)

2. 在浏览器打开看板。
   看板照常出现（这次是设置向导「正在将 Claude Code 设为你的 Agent」），没有任何关于 skill 的提示。
   ![打开看板](02-open-the-board.png)
   [页面文字](02-open.log)

3. 回到终端再看项目。
   多出 `.claude/`、`.agents/` 两个未跟踪的文件夹和 `.git/hooks/pre-commit`；`.claude/skills/kanban/SKILL.md` 就是看板的 skill。
   [打开之后](03-after.log)

4. 点「进入看板」，打开右上角「配置」→「通用」。
   第一组是「交付」，等 90 秒也没有出现「安装」区。
   ![设置里没有安装区](04-settings-nothing-to-do.png)
   [等待结果](04-settings.log)

5. 删掉两个 skill 文件夹，把项目文件夹设为只读，刷新页面，再打开「配置」→「通用」。
   「安装」区出现在最上面：「WildCrane Skill · 未安装」和「添加 Skill」按钮，下面一句「Skill 未能写入这个项目，请检查项目文件夹是否可写。」；不显示原始报错和文件夹路径。
   ![Skill 未能写入](05-skill-not-written.png)
   [安装区文字](05-not-written.log)

6. 把项目文件夹改回可写，点「添加 Skill」。
   「安装」区整个消失，两个 skill 文件夹写回项目；重新打开「通用」，第一组仍是「交付」。
   ![写回之后](06-write-it-again.png)
   [写回之后的项目](06-after.log)

## Feedback

- **无感安装**：打开项目就装好，不用找按钮，也不用等第一次对话；代价是 `git status` 里突然多出两个文件夹，看板上没有一句说明它们从哪来。
- **就绪时真的不打扰**：akb 在 PATH 上且是当前版本时，「通用」里只有平常的设置。
- **出错时说得清楚**：只读时只出现出问题的那一行、一句人话原因和一个按钮；修好后整个「安装」区消失。
- **新名字一致**：出问题的那一行写的是「WildCrane Skill」，和标签页、导览里的产品名对得上。
- **没有跑到的**：akb 版本落后或不在 PATH 上时的那一行；桌面应用里的「安装 / 修复」按钮（见 `install-the-akb-command-from-settings-and-check-it`）；看板底部设置条上的「添加 Skill」按钮；英文界面；Linux。
