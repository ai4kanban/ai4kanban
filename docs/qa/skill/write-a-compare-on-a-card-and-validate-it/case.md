# 在卡片上手写 `<Compare>`，让 `akb raw validate` 指出写错的地方

## Setup

- **项目**：一次性 git 项目，`akb install` 新装，删掉 `setup-checklist.md`、自带的 #1 和索引里它那一行后提交。
- **卡片**：#2「对比原片和复刻」，带齐 `## Worth noting`、`<!-- agent -->`、`## Scope`、`## Todo`、`## Decided by the agent`；开场白下面一段只放一个 `<Compare>`。
- **素材**：卡片素材目录 `.akb/boards/docs/kanban/assets/2/` 里有 `source.mp4`（5.2 秒）、色相偏了一点的 `clone.mp4` 和一张 `source.png`。
- **终端**：zsh，`env -i` 只留 `PATH`、`HOME` 和 `AI4KANBAN_HOME`；日志里的 `akb` 就是这次构建出的命令。

## Steps

1. 写 `<Compare a=".assets/2/source.mp4" b=".assets/2/source.png" label="原片与复刻" />`，执行 `akb raw validate`。
   退出码 1，指到 `<Compare>` 那一行：`[compare-src] Compare a and b must both be images or both be videos.`
   [01-mixed-kinds.log](01-mixed-kinds.log)

2. 把 `b` 换成 `clone.mp4`，加上 `a-label="原片" b-label="复刻" shots=".assets/2/shots.json"`；`shots.json` 列三个镜头，S1 到 1.8 秒结束、S2 却从 2.0 秒开始。再执行 `akb raw validate`。
   退出码 1：`[compare-shots] … Shot S2 starts at 2s, but the one before ends at 1.8s.`，后面附一句正确格式的写法。
   [02-shots-gap.log](02-shots-gap.log)

3. 把 S2 改成从 1.8 秒开始，再执行 `akb raw validate`。
   `Spec format valid (1 card).`，退出码 0。
   [03-valid.log](03-valid.log)

## Feedback

- **错误说得准**：两次都指到 `<Compare>` 所在行，说清是哪一边、哪个镜头、差了多少秒，照着改一次就过。
- **给了正确写法**：镜头不连续时直接附上 JSON 的样子，不用翻文档。
- **写法要先知道**：`<Compare>` 的属性和 `shots` 格式只写在给 agent 的写卡规则里；用户手写时只能从报错倒推。
- **没有跑到的**：卡片上实际画出来的样子和同步播放（属于 local-ui）；文件不在本卡素材目录、标签和文字挤在同一行的报错。
