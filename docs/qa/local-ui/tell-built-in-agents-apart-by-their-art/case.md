# 在配置里凭角色图认出每个内置 Agent

## Setup

- **看板**：一个刚用 `akb install` 建好的看板，界面语言中文，没有自建 Agent。
- **界面**：浏览器打开看板 UI（`kanban-ui`），窗口 1280×1000。截图只截 Agent 列表或右侧详情的头部。

## Steps

1. 点右上角的「配置」，再点左栏的「工作流」。
   「规划」「执行」「定期运行」三组里每个 Agent 前都是同一只小机器人，穿着各自的职业装：软件规划师是船长帽和深蓝双排扣大衣，开发是薄荷绿连帽卫衣，界面设计师是橙色贝雷帽，质检员是黄色安全帽。靠帽子和衣服区分，不靠手里的道具。
   ![工作流的 Agent 列表](01-workflow-list.png)
   [每行的角色图](01-workflow-list.log)

2. 点「竞品调研」。
   右侧详情头部是放大的同一张图：棕色猎鹿帽、卡其色风衣。
   ![竞品调研](02-competitor-research.png)
   [详情的角色图](02-competitor-research.log)

3. 点「产品配图」。
   详情头部是戴宽檐草帽、穿桃色衣服的机器人。
   ![产品配图](03-illustrator.png)
   [详情的角色图](03-illustrator.log)

4. 点「质检员」。
   详情头部是戴黄色安全帽、穿青绿连体工装的机器人。
   ![质检员](04-qa-manager.png)
   [详情的角色图](04-qa-manager.log)

5. 点「规划助手」右端的「+」，输入 `release-notes`，按回车。
   「规划助手」末尾多出「Release notes」：没穿职业装的黑色机器人，左上臂一枚奶白圆形徽标，上面是大写的「R」。
   ![自建 Agent 在列表里](05-custom-agent.png)
   [每行的角色图](05-custom-agent.log)

6. 看右侧详情头部。
   同一个机器人放大，徽标「R」仍在左臂上，清楚可读；标题旁写「你添加的」。
   ![自建 Agent 的详情](06-custom-agent-head.png)
   [详情的角色图](06-custom-agent-head.log)

7. 点左栏的「看板」。
   看板自带的 Agent 也各有职业装：规划助手、回顾对话、整理记忆、回顾拒绝和忽略记录、描述项目、建议后续任务，没有一个是带徽标的通用机器人。
   ![看板自带的 Agent](07-board-agents.png)
   [每行的角色图](07-board-agents.log)

8. 点「描述项目」。
   详情头部是戴天蓝小帽、穿白衣配天蓝领巾的机器人。
   ![描述项目](08-project-writer.png)
   [详情的角色图](08-project-writer.log)

## Feedback

- **一眼分得开**：帽子轮廓各不相同，26px 的列表里也能凭帽子认出谁是谁，比旧版只靠手里的小道具好认得多。
- **自建 Agent 有了自己的位置**：通用机器人臂上的首字母徽标在 26px 和 44px 下都清楚；但所有自建 Agent 只差一个字母，同首字母的两个（如 `release-notes` 和 `reviewer`）在列表里分不出来。
- **服装不说明职业**：图好认，但「猎鹿帽＝竞品调研」「草帽＝产品配图」要靠记，第一次看仍得读名字。
- **自建 Agent 的说明是英文**：中文界面下新建的 Agent 说明是「Unwritten — say here when a card needs this agent…」，和周围的中文不搭。
- **没有跑到的**：桌面应用（Electron）、深色模式、办公室里的走路、工作和沙发姿势（见[在运行办公室里看每个 Agent 穿着自己的职业装](../see-each-agent-in-its-own-outfit-in-the-runs-office/case.md)）。
