// 简体中文 —— the board screen, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { BoardCopy } from "./types";

const zh: BoardCopy = {
  reading: "正在读取看板…",
  notice: {
    planning: (release) =>
      `正在规划 **${release}**——Agent 会把实现该版本目标的卡片移进来，并补写看板上还没有的卡片。它们会陆续出现在这里。`,
    watchRun: "查看运行",
    planNotStarted: (release, why) => `${release} 已创建，但按目标填充没能启动：${why}`,
    changelogMissing: (release, why) => `**${release}** 已关闭，但更新日志没有写成——${why}。`,
    changelogStopped: "运行被中止",
    changelogUnfinished: "运行没有跑完",
    changelogWriteIt: (command) => `可以用 \`${command}\` 补写。`,
    dismiss: "知道了",
    allPlanned: "所有待办卡片都已归入某个版本，没有等待规划的内容。在上方选择一个版本查看。",
    releaseEmpty: (release) => `**${release}** 没有待办卡片。`,
    showNoRelease: "查看未归入版本的卡片",
    offline: (lastRead) =>
      `Cloud 暂时无法连接。当前显示的是 ${lastRead} 读取的副本——可以查看看板，在 Cloud 恢复之前无法保存。`,
    offlineNeverRead: "Cloud 暂时无法连接，而这个检出从未读取过它的工作区，因此没有可显示的看板副本。",
  },
  queue: {
    ready: "待开发",
    readyCount: (ready, implementing) => `${ready} 个待开发 · ${implementing} 个开发中`,
    notReady: "未就绪",
    recurring: "周期任务",
    empty: "没有待办卡片",
    columns: "列",
    goToColumn: (title) => `显示「${title}」`,
  },
  card: {
    tick: (id, title) => `勾选 #${id} ${title}`,
    untick: (id, title) => `取消勾选 #${id} ${title}`,
    tickHint: "勾选后可把这张卡片移入某个版本",
    questionsOne: "1 个待澄清问题",
    questionsMany: (n) => `${n} 个待澄清问题`,
    needsYouOne: "1 个待你决定",
    needsYouMany: (n) => `${n} 个待你决定`,
    verify: (n) => `${n} 项需人工验收`,
  },
  create: {
    button: "新建任务",
    startFailed: "Agent 未能启动",
  },
  bulk: {
    tickedOne: "已勾选 1 张卡片",
    tickedMany: (n) => `已勾选 ${n} 张卡片`,
    move: "移入…",
    moving: "移动中…",
    noRelease: "不属于任何版本",
    untickAll: "全部取消勾选",
    failedOne: "这张卡片没有移动成功，其余的都已完成：",
    failedMany: (n) => `这 ${n} 张卡片没有移动成功，其余的都已完成：`,
  },
  release: {
    which: "显示哪个版本",
    whichHint: "一次只看一个版本，或只看未归入版本的卡片——阻塞项始终显示",
    none: (count) => `不属于任何版本（${count}）`,
    noneHint: "尚未承诺给任何版本",
    new: "新建版本…",
    menu: (release) => `对 ${release} 的操作`,
    whatItIsFor: "这个版本要做什么",
    fillFromGoal: "按目标填充",
    close: "关闭版本",
    drop: "废弃版本",
    goal: {
      title: (release) => `${release} 要做什么`,
      blurb:
        "用你自己的话写一两句——这个版本想交付什么。它会写在 `docs/kanban/releases.md` 里该版本那一行上，也是按目标填充时规划的依据。留空也可以。",
      placeholder: "第一个值得拿给别人看的版本：一个能从头跑到尾的看板。",
      saveFailed: "目标保存失败",
    },
    plan: {
      title: (release) => `按目标填充 ${release}`,
      blurb: (release) =>
        `Agent 会读取 **${release}** 要做什么，把实现它的待办卡片移入该版本，并补写目标需要而看板上还没有的卡片。它自主决策——不需要你等待。`,
      background:
        "它在后台运行——可以在运行面板中查看它移动和补写了什么。已经归入其他版本的卡片会留在原处，因此重复填充只会新增，不会覆盖。",
      start: "填充版本",
      starting: "启动中…",
      startFailed: "运行未能启动",
    },
    closing: {
      title: (release) => `关闭 ${release}`,
      blurb: (release) =>
        `**${release}** 已经交付。交付内容会写进它的总结文件，并从版本列表中永久移除——关闭后的版本无法重新打开。`,
      reading: "正在读取本次关闭会记录的内容…",
      shippedNone: "没有卡片在该版本下归档——总结将记为未交付任何内容。",
      shippedOne: "1 张已归档卡片会记为已交付。",
      shippedMany: (n) => `${n} 张已归档卡片会记为已交付。`,
      changelogNone: "不会写更新日志——没有可写的内容。",
      changelog:
        "随后 Agent 会在总结文件顶部写一段简短的更新日志，说明这个版本改了什么。它在后台运行，可在运行面板中查看。",
      unarchivedOne:
        "这张待办卡片的所有 todo 都已勾选，但从未归档，因此记为未交付。如果它确实已经交付，请取消本次关闭并先归档。",
      unarchivedMany: (n) =>
        `这 ${n} 张待办卡片的所有 todo 都已勾选，但从未归档，因此记为未交付。如果它们确实已经交付，请取消本次关闭并先归档。`,
      leftNone: "该版本下没有待办卡片——不会有任何变动。",
      leftOne: "这张待办卡片会失去所属版本——仍然要做，只是不再承诺给某个版本：",
      leftMany: (n) => `这 ${n} 张待办卡片会失去所属版本——仍然要做，只是不再承诺给某个版本：`,
      confirm: "关闭版本",
      closing: "关闭中…",
      failed: "版本关闭失败",
    },
    dropping: {
      title: (release) => `废弃 ${release}`,
      blurb: (release) =>
        `**${release}** 不会交付。它会从版本列表中移除，不留任何交付记录——它的待办卡片回到不属于任何版本的状态，也不会写总结文件。已经在该版本下归档的卡片保持归档。`,
      reading: "正在读取本次废弃会影响的内容…",
      archivedNone: "没有卡片在该版本下归档。",
      archivedOne: "这张已归档卡片继续归档在该版本下：",
      archivedMany: (n) => `这 ${n} 张已归档卡片继续归档在该版本下：`,
      leftNone: "该版本下没有待办卡片——没有卡片需要回到无版本状态。",
      leftOne: "这张待办卡片会失去所属版本——仍然要做，只是不再承诺给某个版本：",
      leftMany: (n) => `这 ${n} 张待办卡片会失去所属版本——仍然要做，只是不再承诺给某个版本：`,
      confirm: "废弃版本",
      dropping: "废弃中…",
      failed: "版本废弃失败",
    },
    make: {
      title: "新建版本",
      fromGoal: "按目标规划",
      noGoal: "不设目标",
      blurb:
        "用你自己的话取一个版本号——`v1`、`0.5.0`、`august` 都可以。它会追加到 `docs/kanban/releases.md` 列表末尾，看板也会切换过去，这样你接下来写的卡片就会落在它里面。",
      idPlaceholder: "v1",
      goalAsk: "这个版本要做什么？用你自己的话写一两句——Agent 会照着它规划这个版本。",
      goalPlaceholder: "第一个值得拿给别人看的版本：一个能从头跑到尾的看板。",
      goalReady:
        "Agent 会把实现该目标的待办卡片移进来，并补写看板上还没有的卡片。版本会立即创建，运行则在后台继续，可在运行面板中查看。",
      goalMissing:
        "请说明这个版本要做什么，或改用「不设目标」创建——这一栏为空就没有可供规划的依据。",
      confirm: "创建版本",
      making: "创建中…",
      failed: "版本创建失败",
    },
    autoFill: {
      reading: "正在读取未规划的高优先级卡片…",
      on: "把所有未规划的高优先级卡片放进来",
      nothingToMove: "没有未规划的高优先级卡片——这个版本会是空的",
      goesInOne: "1 张卡片会放进来",
      goesInMany: (n) => `${n} 张卡片会放进来`,
      skippedOne: "——另有 1 张因阻塞或身为任务组根卡片而保持未规划",
      skippedMany: (n) => `——另有 ${n} 张因阻塞或身为任务组根卡片而保持未规划`,
    },
  },
};

export default zh;
