# General

## Sub-runs

- **`--dir` 放在子命令后面**：`akb raw list --archived --since last-run --dir <project>`；写在 `raw` 前会吞掉 `--archived`。
- **子运行可能写进主检出**：收尾时同时查工作区和主检出的 `git status docs/qa`，把落在主检出的场景搬回工作区再改索引。
- **`run wait` 的输出别经管道判断**：直接前台反复跑，读完整输出；后台循环里过滤它常常什么都拿不到。
- **子运行别在工作区里构建官网**：几个子运行共用工作区的 `web/`，同时 `next build` 会互相打断；任务里叫它们拷到 `/tmp` 再构建。

## Proof

- **看板界面的「配置」按钮要真鼠标点**：CDP 里 `Runtime.evaluate` 的 `.click()` 打不开配置弹窗，用 `Input.dispatchMouseEvent` 点按钮中心。
