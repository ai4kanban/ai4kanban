# 在文档里查否决一张卡时写的原因去了哪里

## Setup

- **站点**：官网（`web/`）在本地跑起来，浏览器打开 `/docs/daily-loop`，窗口宽 1280px。
- **读者**：刚在看板上否决过一张卡、想知道填的原因会留在哪、谁能看到的人。

## Steps

1. 打开文档的「The daily loop」页。
   右侧「On this page」目录里有一项「Reject an idea」。
   ![Daily loop 页与右侧目录](01-docs-page.png)

2. 点目录里的「Reject an idea」。
   页面滚到这一节，目录里该项高亮。开头一句说卡片进归档并标为 **Rejected**，下面三条：
   「The reason stays on the card」——原因原样留在卡上，在归档里打开这张卡、**Rejected** 下面读到，文件里是 `rejected_reason` 一行，随看板提交和同步，能读卡的人都能读到，应用里不能修改或撤回；
   「Memory is separate」——只有值得长期记住的否决才在 `rejected.md` 留一行；
   「Discard」——在卡片页点 **Remove**、原因留空，按钮写 **Discard**，不写记忆、卡上没有原因，这个想法以后还可能回来；说「don't record it」但给了原因，原因仍留在卡上。
   整页不再出现「Just discard」和「Reject dialog」。
   ![Reject an idea 一节](02-reject-an-idea.png)

## Feedback

- **该知道的都在**：原因留在哪、去哪读、谁能看到、能不能撤回，一条里讲完；三条粗体标题扫一眼就能找到自己的问题。
- **「会被别人看到」埋在句中**：这是读者最该提前知道的一点，却排在第一条的后半句，没有单独成句，也没有提示「所以别写不想公开的话」。
- **「不能撤回」后面没有出路**：只说应用里改不了，没说可以直接改卡片文件里的那一行；写错了的人读到这里是卡住的。
- **和界面的叫法差一点**：文档说「read it under **Rejected**」，界面上那个框的标题是「Reason」；照着找不会找错，但词对不上。
- **按钮有了出处**：第三条现在说在卡片页点 **Remove**，和界面上的按钮同名，照着能找到。
- **小节叫 Reject，按钮叫 Remove**：标题和开头讲「reject #4」，到第三条才出现 **Remove**，没说这两个是同一个动作；想在界面上否决的人要自己推出来「点 Remove 再写原因」。
- **第三条一句里两个符号**：「— the button reads **Discard**: no memory…」先破折号后冒号，要读两遍才分清哪段是结果。
- **「don't record it」那句绕**：丢弃、不写记忆、原因仍留在卡上，三件事挤在一句话里，要读两遍。
- **没有跑到的**：窄屏下的这一节、从站内搜索进到这一节；`kanban-ui/README.md` 里三处按钮名同样改成了 Remove，它只在仓库和 npm 页面上被读到，这次没有截证据。
