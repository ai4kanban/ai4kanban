// 简体中文 —— the sentences the server writes itself, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { RefusalArgs } from "@/lib/format/agent/types";
import type { MessagesCopy } from "./types";

// A card number sits apart from the Chinese around it; a word does not.
const spaced = (task: string): string => (task.startsWith("#") ? ` ${task}` : task);

// How to bring back a workflow lead whose file the board does not use, by `cause`.
const leadFix = (a: RefusalArgs): string => {
  switch (a.cause) {
    case "oldKeys": {
      const keys = (a.keys ?? "").split(",").map((key) => `\`${key}\``);
      return `请在它的 AGENT.md 中把 ${keys.join("、")} 换成 \`${a.line}\`。`;
    }
    case "noFile":
      return "它的文件夹中缺少 AGENT.md，请补上。";
    case "nameTaken":
      return "它与另一个 Agent 重名，请为其中一个改名。";
    case "folderName":
      return `它的文件夹名是 \`${a.folder}\`，AGENT.md 中却是 \`name: ${a.declared}\`，请改成一致。`;
    default:
      return "它的 AGENT.md 有错误，详情见「配置 → 工作流」。";
  }
};

const zh: MessagesCopy = {
  rules: {
    none: "找不到读取这个看板所需的 akb 命令：PATH 中没有 `akb`。",
    noneLookedIn: (paths) =>
      `找不到读取这个看板所需的 akb 命令：PATH 中没有 \`akb\`，${paths} 也不存在。`,
    tooOld: (path) => `${path} 处的 akb 命令版本过旧，无法读取这个看板。`,
    installIt: "请运行 `npm install -g ai4kanban` 安装。",
    tooOldForCloud: "akb 命令版本过旧，无法登录 Cloud。",
    tooOldForChat: "akb 命令版本过旧，无法进行对话。",
    tooOldForSkip: "akb 命令版本过旧，无法跳过问题。",
    tooOldForMemory: "akb 命令版本过旧，无法读取看板记忆。",
    tooOldForArchive: "akb 命令版本过旧，无法读取看板归档。",
    tooOldForSignals: "akb 命令版本过旧，无法使用待筛选。",
    tooOldForNotifications: "akb 命令版本过旧，无法使用 Cloud 通知。",
    tooOldForPictures: "akb 命令版本过旧，无法添加图片。请运行 `npm install -g ai4kanban` 更新。",
    tooOldForSetup: "akb 命令版本过旧，无法进行首次设置对话。",
    updateIt: "请运行 `npm install -g ai4kanban` 更新。",
  },
  tooOld: {
    autoDelivery: "akb 命令版本过旧，无法使用自动交付。请运行 `npm install -g ai4kanban` 更新。",
    silenceLimit: "akb 命令版本过旧，无法设置静默上限。请运行 `npm install -g ai4kanban` 更新。",
    deliveries: "akb 命令版本过旧，无法使用交付。请运行 `npm install -g ai4kanban` 更新。",
    worktrees: "akb 命令版本过旧，无法在独立工作目录中交付。请运行 `npm install -g ai4kanban` 更新。",
    resumeDelivery: "akb 命令版本过旧，无法继续交付。请运行 `npm install -g ai4kanban` 更新。",
    agents: "akb 命令版本过旧，无法读写这个看板的 Agent",
    language: "akb 命令版本过旧，无法设置语言。请运行 `npm install -g ai4kanban` 更新。",
    skillInstall: "akb 命令版本过旧，无法安装 Skill",
    specAgentSwitch: "akb 命令版本过旧，无法开关补充规格的 Agent",
    specAgentSetting: "akb 命令版本过旧，无法设置补充规格的 Agent",
    runtimes: "akb 命令版本过旧，无法使用命名运行时。请运行 `npm install -g ai4kanban` 更新。",
    usageReporting: "akb 命令版本过旧，无法设置使用情况上报。请运行 `npm install -g ai4kanban` 更新。",
    schedules: "akb 命令版本过旧，无法使用这些定期运行设置。请运行 `npm install -g ai4kanban` 更新。",
  },
  actions: {
    noSuchCard: "这不是本看板上的卡片。",
    emptyChat: "请先写点什么再发送。",
    noPlan: "这段讨论还没有可用于写卡片的方案。",
    planHanded: "这份方案已提交。",
    exportFolder: "请填写看板导出目录。",
  },
  run: { noProcess: "未能为本次运行启动进程" },
  refusal: {
    dirty: () => "先提交或暂存这些改动",
    busy: () => "这个项目文件夹中已有任务正在执行",
    worktree: () => "未能为这个任务创建分支和独立工作目录",
    akb: () => "未能准备这个任务所需的文件夹",
    noPlan: () => "这段讨论还没有可用于开始执行的方案",
    planHanded: () => "这份方案已提交",
    noProcess: () => "未能启动运行",
    rules: () => "akb 命令版本过旧，请运行 `npm install -g ai4kanban` 更新",
    runNotFound: (a) => `找不到编号为「${a.id}」的运行。`,
    runAmbiguous: (a) => `「${a.id}」匹配多个运行，请提供更完整的编号。`,
    runGoing: () => "该运行尚未结束。",
    runNotResumable: () => "只有失败、已中断或已中止的运行才能继续。",
    runNoSession: () => "该运行没有可用于继续的会话。",
    runContinued: () => "该运行已继续过。",
    runForeign: (a) => `当前版本无法继续由 ${a.agent} 开始的对话。`,
    subRunResume: () => "子运行不能单独继续，会由启动它的运行重新启动。",
    subRunNested: () => "子运行不能再启动子运行。",
    sortUnavailable: () => "此看板暂不支持筛选。",
    discardUnfinished: () => "有一张卡片未能丢弃，请先重试丢弃，再继续创建。",
    creationHeld: () => "本次创建中的一张卡片正在处理，请等待该运行结束。",
    deliveryUnnamed: (a) =>
      ({
        cancel: "请指定要取消的交付。",
        resume: "请指定要继续的交付。",
        discard: "请指定要丢弃的交付。",
      })[a.action] ?? "请指定交付。",
    deliveryNotFound: (a) => `找不到编号为「${a.id}」的交付。`,
    deliveryActive: (a) => `交付 ${a.id} 尚未结束，仍在处理${spaced(a.task)}。`,
    deliveryFinished: (a) => `交付 ${a.id} 已完成；只有异常结束的交付才能继续。`,
    deliveryCancelled: (a) => `交付 ${a.id} 已取消，相关工作已丢弃。请重新启动${spaced(a.task)}。`,
    deliveryFiles: (a) => `交付 ${a.id} 直接在项目中生成文件，没有可继续的分支。请重新启动${spaced(a.task)}。`,
    deliveryManual: (a) => `交付 ${a.id} 在项目文件夹中提交，没有可继续的独立分支。请重新启动${spaced(a.task)}。`,
    deliveryWorktreeGone: (a) =>
      `交付 ${a.id} 的独立工作目录 ${a.path} 已不存在，无法继续。请用 \`${a.command}\` 丢弃它，再重新启动${spaced(a.task)}。`,
    deliveryBranchGone: (a) =>
      `交付 ${a.id} 的分支 ${a.branch} 已不存在，无法继续。请用 \`${a.command}\` 丢弃它，再重新启动${spaced(a.task)}。`,
    deliveryCardGone: (a) => `#${a.card} 已不在看板上，交付 ${a.id} 无法继续。`,
    deliveryHeld: (a) => `交付 ${a.other} 正在处理 #${a.card}，请先用 \`${a.command}\` 结束它。`,
    deliveryTakenOver: (a) => `本次交付结束后，交付 ${a.other} 已接手 #${a.card}，本次交付无法再继续。`,
    deliveryRunGoing: (a) => `交付 ${a.id} 仍有运行尚未结束。`,
    deliveryNone: (a) => `${a.on} 没有进行中的交付，无法执行此操作。`,
    planEmpty: (a) => `${a.path} 尚未写入内容，无法开始执行。`,
    cardBusy: (a) => `#${a.card} ${a.verb}，请等待该运行结束。`,
    cardDiscarded: (a) => `#${a.card} 已丢弃，请勿恢复或重新创建。`,
    cardCreating: (a) => `运行 ${a.run} 仍在创建 #${a.card}，完成后才能进行「${a.act}」。`,
    cardUnfinished: (a) =>
      `#${a.card} 尚未创建完成：运行 ${a.run} 提前结束。请先在看板上继续该运行完成创建，或直接丢弃这张卡片。`,
    cardDiscussed: (a) => `#${a.card} 的对话正在回复，暂时无法进行「${a.act}」。回复完成或中止后即可操作。`,
    workflowUnknown: (a) => `#${a.card} 指定了「${a.workflow}」工作流，但看板中没有该工作流。`,
    planDelivered: () => "此卡片在规划阶段完成，请直接归档。",
    workflowNoLead: (a) => `「${a.name}」的「${a.stage}」阶段尚无负责 Agent，请先分配再启动。`,
    workflowLeadMissing: (a) => `「${a.name}」的「${a.stage}」阶段指定了 ${a.agent}，但看板中没有该 Agent。`,
    workflowLeadRefused: (a) => `「${a.name}」的「${a.stage}」阶段负责 Agent ${a.agent} 无法使用：${leadFix(a)}`,
    workflowLeadStage: (a) => `「${a.name}」的「${a.stage}」阶段指定了 ${a.agent}，但该 Agent 属于「${a.assigned}」阶段。`,
    proSignIn: (a) => `「${a.name}」需要 Pro，请先登录。`,
    proRequired: (a) => `「${a.name}」需要 Pro。`,
    proUnconfirmed: () => "无法确认 Pro 套餐，请联网后重试。",
    cloudUnreachable: () =>
      "无法连接 Cloud，运行未启动。运行需要访问 Cloud 工作区，不能使用这台电脑上留存的副本。请在看板恢复连接后重试。",
    cardHeld: (a) => `${a.details} 请等待占用结束，或先处理其他卡片。`,
    runtimeUnnamed: () => "请填写运行时名称。",
    runtimeTaken: (a) => `看板中已有名为「${a.name}」的运行时。`,
    runtimeNotFound: (a) =>
      a.runtimes
        ? `看板中没有名为「${a.id}」的运行时。可用运行时：${a.runtimes}。`
        : `看板中没有名为「${a.id}」的运行时。`,
    runtimeKey: (a) => `${a.name} 不支持「${a.key}」设置。`,
    harnessNotFound: (a) => `没有名为「${a.name}」的连接器，请用 \`akb agent list\` 查看当前版本支持的连接器。`,
    globalRename: () => "全局默认运行时不能重命名，它是所有 Agent 的默认选择。",
    globalDelete: () => "全局默认运行时不能删除，未指定运行时的 Agent 会使用它。",
    harnessUnused: (a) =>
      `看板中没有使用「${a.name}」的运行时，请用 \`akb agent runtime add\` 添加，或让全局默认运行时使用它。`,
    workflowUnnamed: () => "请填写工作流名称。",
    workflowTaken: (a) => `看板中已有名为「${a.name}」的工作流。`,
    workflowNotFound: (a) => `看板中没有 \`${a.id}\` 工作流。`,
    workflowBuiltInRename: (a) => `「${a.name}」是内置工作流，请先复制，再修改名称。`,
    workflowBuiltInChange: (a) => `「${a.name}」是内置工作流，请先复制，再进行修改。`,
    workflowBuiltInDelete: (a) => `「${a.name}」是内置工作流，不能删除。`,
    workflowBuiltInLeads: (a) => `「${a.name}」是内置工作流，负责 Agent 不可更改。请先复制，再重新分配。`,
    agentNotFound: (a) => `看板中没有 ${a.agent} Agent。`,
    agentCannotLead: (a) => `${a.agent} 属于「${a.assigned}」阶段，不能负责「${a.stage}」阶段。`,
    agentNotLead: (a) => `${a.agent} 只能作为协助 Agent，不能负责阶段。`,
    agentHelps: (a) => `${a.agent} 已在此阶段之后运行，不能再负责此阶段。`,
    agentCannotHelp: (a) => `${a.agent} 属于「${a.assigned}」阶段，不能协助「${a.stage}」阶段。`,
    agentLeadNotHelper: (a) => `${a.agent} 是负责 Agent，不能在阶段之后运行，否则会重复执行整个「${a.stage}」阶段。`,
    agentLeads: (a) => `${a.agent} 负责此阶段，始终启用。`,
    agentOtherWorkflow: (a) => `${a.agent} 属于「${a.name}」工作流，请在这里新建一个 Agent。`,
    agentNotHelping: (a) => `${a.agent} 不是「${a.name}」工作流中「${a.stage}」阶段的协助 Agent。`,
    agentNotScheduled: (a) => `${a.agent} 不是这个工作流里定期运行的 Agent。`,
    agentNotSchedule: (a) => `${a.agent} 不能定期运行。`,
    scheduledRunning: (a) => `${a.agent} 正在运行。`,
    scheduledLanding: (a) => `${a.agent} 上一次运行的改动还在提交中，请稍后再试。`,
    minutes: () => "请填写整数分钟数，填 0 表示关闭。",
    fileParse: (a) => `无法保存：${a.path} 格式无效（${a.details}）。请修正文件后重试。`,
    fileWrite: (a) => `无法写入 ${a.path}：${a.details}`,
    fileRead: (a) => `无法读取 ${a.path}：${a.details}`,
    gitignoreWrite: (a) => `无法写入 ${a.path}，未能设置密钥文件的 Git 忽略规则：${a.details}`,
    cadence: (a) => `「${a.cadence}」不是有效的运行周期，请使用 ${a.formats}。`,
    chatUnavailable: (a) => `${a.agent} 不支持对话。支持对话的 Agent：${a.agents}。`,
    chatRuntimeGone: (a) =>
      `这段对话由 ${a.previous} 开始，但看板中已没有对应的运行时，其他 Agent 无法接续。请清空对话，再使用 ${a.agent} 重新开始。`,
    chatNoImages: (a) => `${a.agent} 不支持图片。支持图片的 Agent：${a.agents}。`,
    chatRuntime: (a) => `${a.runtime} 不支持对话。支持对话的运行时：${a.runtimes}。`,
    chatPicturesGone: () => "这些图片已不在这台电脑上。",
    chatEmpty: () => "请先写点什么再发送。",
    chatBusy: () => "这段对话还在回复上一条消息。",
    skillNotInstalled: () => "未能安装 kanban Skill。",
    chatForeign: (a) => `${a.agent} 无法继续由 ${a.previous} 开始的对话，请清空后重新开始。`,
    chatNoSession: () => "这段讨论没有可继续的会话，请继续讨论后再试。",
    chatNoFork: (a) => `${a.agent} 无法基于这段讨论直接开始，请改用「规划任务」。`,
    chatClosed: () => "这段讨论已写成卡片，请在卡片中继续对话。",
    planNotFound: (a) => `${a.path} 不是本看板的方案。`,
  },
  theBuild: "本次执行",
  chat: {
    busy: "这段对话还在回复上一条消息。",
    sendFailed: "消息发送失败。",
    clearFailed: "对话未能清空。",
    pickFailed: "未能更改此对话使用的 Agent 或模型。",
  },
  mockup: {
    notAMockup: (src, exts) => `${src}：素材路径应为 .assets/<卡片编号>/<文件名>，后缀为 ${exts}`,
    outside: (src) => `${src}：素材只能从本卡片的素材目录读取，此路径指向目录之外`,
    missing: (src) => `${src}：这台电脑上没有该文件`,
    notDrawn: (src, why) => `${src}：素材无法显示：${why}`,
    cannotImport: (id) => `素材导入了「${id}」，此处无法使用。请将其一并复制到素材目录，或改用不依赖它的写法`,
    noSuchFile: (id) => `素材导入了「${id}」，但素材目录中没有该文件`,
    outsideFolder: (id) => `素材导入了「${id}」，但素材只能读取所在目录中的文件`,
    tooManyFiles: (files) => `素材引用的文件超过 ${files} 个`,
    noDefault: "素材没有默认导出任何组件",
    tooSlow: (seconds) => `素材未能在 ${seconds} 秒内完成渲染`,
    noStylesheet: "缺少渲染此画面所需的样式",
  },
};

export default zh;
