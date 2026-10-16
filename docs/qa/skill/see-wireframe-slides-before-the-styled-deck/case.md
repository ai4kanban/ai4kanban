# 规划一份演示文稿：先看线框稿和样张，再拿到可编辑的 PPT

## Setup

- **项目**：一次性 git 项目，`README.md` 写着 Ledgerly 的功能、价格（Solo $9/月、Studio $29/月 5 人、14 天试用）和两个数字（2,400 位付费用户、38% 的发票在首次提醒后 3 天内付清）；`akb install` 新装，删掉 `setup-checklist.md`、自带的 #1 和索引里它那一行后提交。
- **账号**：已登录 Cloud 且是 Pro（本地假 Cloud 应答 `/v1/billing`）；「演示文稿」工作流需要 Pro。
- **Agent**：真实的 Claude Code（`claude-opus-5-5`），界面语言中文。
- **界面**：看板 UI（`kanban-ui`）指向这个项目，浏览器窗口 1440×900。

## Steps

1. 用「演示文稿」工作流建卡：`akb raw create --title "给会计师事务所的 Ledgerly 介绍" --workflow slide-deck --body-file body.md`（正文：给会计师事务所做一份 6 页左右的介绍，讲客户用 Ledgerly 开票后月底对账能省多少事，数字用 README 里的），再执行 `akb card refine 2`。
   建出 #2，返回一次 `refine` 运行。
   [01-refine.log](01-refine.log)

2. 运行结束后（约 9 分钟，$1.73）看卡片和资产目录。
   #2 只有一个问题：线框稿的内容和样张的外观可以吗。``## By `deck-planner` agent`` 一节是一句话的故事线、`<Storyboard src=".assets/2/storyboard.json" label="线框稿" />`、一句话和 `<Storyboard src=".assets/2/samples.json" label="样张" />`，再三条要点（听众、字体、币种）；没有大段的 Brief、Facts、Recipe。线框稿 6 页白底黑字，每页底部一个虚线框写「制作说明：版式…素材…动画…」；`samples.json` 是 3 页套用正式配色的样张（四格、大数字、流程）。
   [02-card.log](02-card.log)
   ![线框稿第 4 页](02-wireframe-month-end.png)
   ![同一页的样张](02-sample-month-end.png)

3. 在看板 UI 打开 `/2`，看「线框稿」。
   标题「线框稿 6 页」，上方一排缩略图，下面逐页大图配右侧「演讲备注」；每页图里能看到占位框和底部的制作说明。
   ![线框稿](03-wireframes.png)

4. 往下看「样张」。
   「样张 3 页」，青绿配色、页脚有「Ledgerly」和页码，同样配演讲备注。
   ![样张](04-samples.png)

5. 执行 `akb card resolve 2 "通过"`。
   返回一次 `resolve` 运行。
   [05-approve.log](05-approve.log)

6. 运行结束后（约 1 分钟，$0.63）看回话、卡片和资产目录。
   第一阶段的待办打勾，新问题是「最终 6 页幻灯片可以交付了吗」；卡片上只剩一个 `<Storyboard src=".assets/2/storyboard.json" />`，预览从交付用的 `.pptx` 渲染；`samples.json`、样张预览和线框稿的中间文件都已删除。回话说明预览里粗体显示成常规字重、箭头只见横线，`.pptx` 里正常。
   [06-stage2.log](06-stage2.log)
   ![最终第 4 页](06-final-month-end.png)

7. 执行 `akb card resolve 2 "通过"`。
   返回一次 `resolve` 运行。
   [07-approve-final.log](07-approve-final.log)

8. 运行结束后（37 秒，$0.29）看回话、卡片和资产目录。
   卡片 **ready**，待办 4/4；`<Asset src=".assets/2/ledgerly-for-accounting-firms.pptx" …/>` 放在卡片正文开头、`## Worth noting` 之上，不在 agent 那一节里；`.pptx` 里有 6 页。
   [08-delivered.log](08-delivered.log)

9. 在看板 UI 刷新 `/2`。
   描述下面就是带下载图标的 `ledgerly-for-accounting-firms.pptx`；标题旁「可以开始执行」，按钮是「修订」「归档」。
   ![卡片顶部的 PPT](09-card-top.png)

10. 展开「演示文稿策划」。
    「幻灯片 6 页」，逐页是最终配色的预览和演讲备注。
    ![最终幻灯片](10-final-slides.png)

## Feedback

- **第一次规划就看得到页面**：线框稿把每页的版式、素材、动画直接写在页上，样张只做 3 页定调，比读一大段配方快得多，也知道要拍板的是什么。
- **制作说明在卡片上太小**：虚线框里的字在卡片预览里几乎看不清，要点「放大查看」才读得到。
- **确认后中间稿自己收拾干净**：样张和线框稿通过后就删了，卡片上只剩最终稿，不会混着看。
- **成品放在最显眼的地方**：交付后的 `.pptx` 就在描述下面，一眼能下载。
- **回话换成了英文**：看板语言是中文，第一轮规划的回话也是中文，但两次 `resolve` 的回话和交付时补进 `Decided by the agent` 的几条都是英文。
- **预览和成品不完全一致**：预览里粗体变常规、箭头没有箭头头部，回话和卡片都提醒了，但第一次看预览还是会以为排版有问题。
- **没有跑到的**：「要改」时只重渲改动的页；在 PowerPoint 里打开 `.pptx` 核对可编辑性。
