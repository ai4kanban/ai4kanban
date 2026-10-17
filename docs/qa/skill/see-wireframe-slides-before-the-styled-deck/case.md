# 规划一份演示文稿：先看线框稿和样张，再拿到图片版 PPT

## Setup

- **项目**：一次性 git 项目，`README.md` 写着 Ledgerly 的价格（Solo $9/月、Studio $29/月 5 人、14 天试用）和两个数字（2,400 位付费用户、38% 的发票在首次提醒后 3 天内付清）；`akb install` 新装。
- **卡片**：`akb raw create --title "给会计师事务所的 Ledgerly 介绍" --workflow slide-deck` 建出 #2。
- **替身 deck-planner**：没有跑真实 agent。第二阶段的产物由替身照 `deck-planner` 的说明手写：卡片资产目录里的 `storyboard.json`（`size` 1920×1080，3 页，预览指向 `pages/<页>.html`）和 3 个静态 HTML 页面，见 [stand-in-deck/](stand-in-deck/)；卡片上是 `<Storyboard src=".assets/2/storyboard.json" />`。
- **界面**：看板 UI（`kanban-ui`）指向这个项目，中文，浏览器窗口 1440×900。

## Steps

1. 打开「配置 → 工作流」，展开工作流选择器，把鼠标停在「演示文稿」上。
   提示气泡：「先确认每页内容，再拿到图片版 PPT（每页一张图，不能直接改字），满意即可归档。」
   ![演示文稿工作流的说明](01-workflow-tip.png)

2. 执行 `akb raw agent-file deck-planner scripts/validate-storyboard.mjs` 和 `… scripts/pack-pptx.mjs`，各存成文件。
   两个脚本都取到；`pack-pptx.mjs` 开头写明用法、只需 Node 18、每页取 `slides/<页>.png`、`notes` 进演讲者备注、缺图退出 1。
   [02-scripts.log](02-scripts.log)

3. 对卡片资产目录里的 `storyboard.json` 执行 `node validate-storyboard.mjs`，再执行 `akb raw validate 2 --json`。
   预览是 `.html` 页面、带 `size` 的分镜报 `valid`；卡片校验通过。
   [03-validate.log](03-validate.log)

4. 在看板 UI 打开 `/2`，展开「演示文稿策划」。
   「幻灯片 3 页」，缩略图和逐页大图直接画出 HTML 页面，右侧是演讲备注。
   ![由 HTML 页面画出的幻灯片](04-slides-from-pages.png)

5. 把每个页面在无头浏览器里按 1920×1080 截成 `slides/<页>.png`，再执行 `node pack-pptx.mjs <资产目录>/storyboard.json <资产目录>/ledgerly-for-accounting-firms.pptx`。
   输出「3 slide(s), one image each」，退出码 0；压缩包里每页一张 `media/imageN.png`、一份 slide 和一份 notesSlide。
   [05-pack.log](05-pack.log)

6. 读 `.pptx` 里的幻灯片尺寸、每页的图片和文字框、演讲者备注。
   16:9；每页 1 张满版图片、0 个文字框、0 段文字；三页备注与 `storyboard.json` 的 `notes` 一致。
   [06-inspect.log](06-inspect.log)

7. 在访达里用快速查看打开这份 `.pptx`。
   第一页就是封面页面的图片，和看板 UI 上的预览一致。
   ![快速查看里的第一页](07-quicklook-first-slide.png)

8. 拿走 `slides/plans.png`（第 3 页的预览是 `.html`，没有图片可退），再打包一次。
   退出码 1：「1 slide(s) have no image. Render each page, then run this script again:」并点名 `slide 3 "plans"`；没有写出新的 `.pptx`。
   [08-missing-image.log](08-missing-image.log)

9. 在卡片描述下加上 `<Asset src=".assets/2/ledgerly-for-accounting-firms.pptx" … />`，刷新 `/2`。
   描述下面是带下载图标的 `ledgerly-for-accounting-firms.pptx`。
   ![卡片顶部的 PPT](09-card-top.png)

## Feedback

- **说明先把代价讲清**：工作流气泡直接写「每页一张图，不能直接改字」，选之前就知道拿到的不是可编辑 PPT，不会交付后才失望。
- **预览就是成品**：看板上画的是页面本身，导出的图又是同一页面截出来的，快速查看里看到的和卡片上一模一样；旧流程里「预览粗体变常规、箭头没头」的落差没有了。
- **打包脚本很省心**：零依赖、一条命令，缺图时点名是哪一页，不会悄悄打出少一页的 PPT。
- **改一个字也得回到 agent**：拿到 PPT 后想改个错字，只能请 agent 改页面再重新导出；给客户临时改一句的场景会很别扭。
- **备注还在**：演讲者备注照样写进 PPT，上台讲时不受影响。
- **没有跑到的**：真实 `deck-planner` 的三个阶段（线框稿、样张、清理中间稿、把 `<Asset>` 放到卡片上）都是替身代做的，agent 是否照说明走没有验证；也没在 PowerPoint 或 Keynote 里放映核对。
