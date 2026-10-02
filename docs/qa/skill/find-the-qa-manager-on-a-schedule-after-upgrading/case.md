# 升级后查看 QA 管理员从「执行之后」搬到了哪里

## Setup

- **三块看板**：各在一个空的 git 项目里，用升级前的版本（QA 管理员还是 Coding 构建后的 hook 的那一版）执行 `akb install`。
  - **A**：留着它，并写了额外要求。
  - **B**：把它关掉了。
  - **C**：什么都没改过。
- **升级**：之后的命令换成这次构建出的 `akb`。日志里两版都写作 `akb`，每个文件只用一版，文件名和步骤说明里写明是哪一版。
- **终端**：zsh，在各自的项目目录里；没有任何 agent，也不启动任何运行。

## Steps

1. 升级前：在 A 执行 `akb workflow stage coding --stage execute --on qa-manager --extra "Write every case in Chinese."`，在 B 执行 `… --off qa-manager`，然后在三块看板上各看 `akb workflow list` 的 Coding 那几行。
   A 和 C 是 `execute builder  → hooks: qa-manager`，B 是 `→ hooks: qa-manager (off)`；都没有 `scheduled` 行。
   [01-before.log](01-before.log)

2. 升级后：在三块看板上各看 `akb workflow list`，并在 A 执行 `akb workflow schedule coding --json`。
   三块看板的 `execute builder` 后面都不再有 hook，多出一行 `scheduled  qa-manager`：A 和 C 是 `every 1d · never run`，B 是 `off · never run`。A 的额外要求原样跟了过来：`"extra":"Write every case in Chinese."`。
   [02-after.log](02-after.log)

3. 在 A 试着把它挂回构建之后：`akb workflow stage coding --stage execute --on qa-manager`，再看 `akb workflow stage coding --stage execute`。
   被拒绝：`` `qa-manager` is a board agent and cannot help execute ``，退出码 1；执行阶段的 hook 是 `(none)`。
   [03-put-it-back.log](03-put-it-back.log)

4. 在 B 执行 `akb workflow schedule coding --on qa-manager`，在 A 执行 `… --off qa-manager`，各再看一次 `akb workflow list`。
   搬过来的设置之后就是普通的周期设置：B 变成 `every 1d · never run · next after <明天此刻>`，A 变成 `off · never run`；再次打开看板不会被搬迁改回去。
   [04-once.log](04-once.log)

5. 在 A 换回升级前的版本，看 `akb workflow list`。
   `execute builder` 后面没有 hook，也没有 `scheduled` 行：搬走的设置不会自己搬回去，旧版本里 QA 管理员哪里都不在了。
   [05-old-version.log](05-old-version.log)

## Feedback

- **升级是无声的**：第一次执行任何命令时设置就搬完了，没有一行提示；用的人只会发现「构建之后不再有 QA 那一遍」，要自己去 `workflow list` 里找到那行 `scheduled`。
- **开着的看板照旧开着，这点让人放心**：开关和额外要求都没丢；之前嫌它慢而关掉的人也不会被重新打开。
- **但含义变了没人说**：以前「开着」是每次构建后把关、失败会挡住交付；现在「开着」是每天自己跑一遍、坏了进待筛选。同一个开关，行为不同，命令行里没有一个字提到。
- **挂不回去，拒绝的话也不指路**：「is a board agent and cannot help execute」既没说它现在按周期运行，也没说想在落地前把关该自己在「执行之后」建一个 Agent。
- **额外要求藏在 `--json` 里**：`akb workflow schedule coding` 的列表不显示它，想确认搬过来没有只能读 JSON。
- **回退会丢**：换回旧版本后 QA 管理员既不在构建之后也不在别处，要手动重新启用；这符合「不自动迁回」，但旧版本同样不提示。
- **没有跑到的**：执行阶段存过别的 hook 但没列 `qa-manager` 的更早的看板（应迁成停用，用命令造不出这种看板）；别的工作流里存着的 `qa-manager` 行被一并摘掉；升级时还在进行、冻结了 `qa-manager` 作为构建后 hook 的交付跳过它照常落地（要一次真实的构建）；界面上的同一次搬迁。
