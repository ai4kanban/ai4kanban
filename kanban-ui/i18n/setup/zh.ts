// 简体中文 —— the first-run setup, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { SetupCopy } from "./types";

const zh: SetupCopy = {
  rail: {
    title: "初始化这个看板",
    blurb: "只有三个问题需要你回答。其余的都会在之后从你的仓库里推导出来。",
    steps: "初始化步骤",
    exit: "进入看板",
    projectSettledOne: (name) => `${name} · 1 个分类`,
    projectSettledMany: (name, tracks) => `${name} · ${tracks} 个分类`,
    goalWritten: "已填写",
    goalSkipped: "稍后再填",
  },
  stepTitles: { project: "项目", goal: "目标", agent: "Harness" },
  reading: "正在读取看板…",
  project: {
    title: "这是个什么项目？",
    blurb: "项目名，加一句话说明。Agent 每次规划工作都会读它，所以平实的描述胜过宣传语。",
    name: "名称",
    what: "它是什么",
    whatPlaceholder: "一个用纯 Markdown 自我规划的看板。",
    tracks: "工作分为哪些类",
    tracksBlurb:
      "每类工作一个归属，每张卡片都落在其中之一。它们就是看板自己的文件夹，因此这里的名字会成为 `docs/kanban/todo/` 下的一个目录。",
    trackName: (n) => `第 ${n} 个分类的名称`,
    trackNote: (track) => `${track} 用来放什么`,
    thisTrack: "这个分类",
    trackNotePlaceholder: "属于它的内容",
    dropTrack: (track) => `删除 ${track}`,
    dropTrackHint: "删除这个分类",
    trackLocked: (track) => `${track} 下还有卡片——请先移走再删除`,
    addTrack: "添加分类",
    keptOne: (tracks) =>
      `已保存，但 ${tracks} 下还有卡片，因此它会留在看板上。如果确实要删除，请先移走或归档这些卡片。`,
    keptMany: (tracks) =>
      `已保存，但 ${tracks} 下还有卡片，因此它们会留在看板上。如果确实要删除，请先移走或归档这些卡片。`,
    saveFailed: "项目信息保存失败",
    continue: "继续",
  },
  goal: {
    title: "这个项目要去往何处？",
    blurb:
      "用你自己的话写：你想要什么、大致多久、接下来大概做什么。Agent 提出的每个提案都会拿它来衡量。写得粗略、简短都没关系——随时可以改。",
    placeholder: "一年之内我希望…",
    guideTitle: "什么样的目标是好目标",
    guideLine: "Agent 绝不会替你起草这段内容。",
    skip: "暂时跳过",
    saveFailed: "目标保存失败",
  },
  agent: {
    title: "由哪个 Harness 来执行工作？",
    blurb:
      "执行看板工作的编码工具。这里的每个按钮都会在它上面发起一次运行——澄清卡片、提出任务、开发实现。选好之后按「测试」：它会发一条很小的消息过去，并告诉你返回了什么。",
    answered: "只有你能回答的部分到此为止。",
    testFirst: "请按上方的「测试」——这个看板上的每个按钮都要经过它。",
    saveFailed: "该项保存失败",
  },
  done: {
    title: "回答完毕——看板归你了",
    blurb:
      "剩下的工作是读你的仓库并思考：规划者需要定下来的判断、项目由哪些部分构成的模块图，以及最初的一批卡片。",
    goalFirst: "**先写目标。** 剩下每一步都以它为依据，写好之后，其余的看板可以自己接手。",
    writeGoal: "填写目标",
    offer:
      "**让看板自己做完。** 它会在这里运行你选定的 Agent，你可以像看待任何一次运行那样查看或中止它。",
    finish: "完成初始化",
    starting: "启动中…",
    handOver: "也可以在你自己的编码 Agent 里完成——把这段粘贴进去：",
    open: "打开看板",
    startFailed: "初始化运行未能启动",
  },
  run: {
    watching: "正在完成初始化——",
    watch: "查看运行",
    failed: "上一次初始化运行中途停止了——",
    readLog: "查看它的日志",
    failedAfter: "了解原因。再启动一次会从第一个尚未完成的步骤接着做。",
  },
  notice: {
    title: "正在初始化这个看板。",
    working: "Agent 正在处理剩下的步骤；完成一步就勾掉一步。",
    next: "下一步：",
    lastStep: "正在完成最后一步。",
    resume: "继续初始化",
    addSkill: "添加 skill",
    addSkillHint: "新建的看板不自带 skill——这里可以添加",
    meter: (done, total) => `初始化：已完成 ${total} 步中的 ${done} 步`,
  },
  goalNotice: {
    tag: "项目目标",
    body: "**项目目标缺失或不清晰。** Agent 提出的每个提案都会拿它来衡量——写得粗略、简短都没关系。",
    write: "填写目标",
    dismiss: "知道了",
    dismissHint: "暂时隐藏",
  },
  handover: {
    open: "更想在你自己的编码 Agent 里完成初始化？",
    close: "算了——继续在这里完成",
    title: "在你的编码 Agent 里完成",
    blurb: "把这段粘贴进去。它会从初始化的当前进度接着做，你在这里回答过的内容不会被再问一遍。",
  },
  addSkillFirst:
    "**你的编码 Agent 还看不到这个看板。** 新建的看板不自带 skill——请先在仓库里运行下面这条命令，再粘贴下一段。（「配置 → 通用」也能在这里完成同样的事。）",
  copy: { hint: "复制给你的编码 Agent" },
  noBoard: {
    title: "这里没有看板。",
    where: (folder) => `\`${folder}\` 及其任何上级目录中都没有 \`docs/kanban/todo/\`。`,
    startTitle: "在这里创建一个",
    startApp: "看板和初始化清单——就在这个窗口里。",
    startBrowser: "会在 docs/kanban/ 下创建看板。请在仓库根目录运行。",
    wrongTitle: "打开了错误的项目",
    wrongApp: "在这个窗口里打开另一个文件夹。之前打开过的项目在上方的项目名后面。",
    wrongBrowser: "把 UI 指向你想要的仓库，或者从那个仓库的根目录重新启动它。",
    comeBack: "运行之后回到这个标签页——看板会自己出现。",
    copy: "复制",
  },
  noRules: {
    title: "这个看板无法读取。",
    installTitle: "安装看板的运行规则",
    installApp: "应用自带一份副本——重新打开这个项目即可加载。",
    installBrowser: "规则由 `akb` 命令携带。安装一次，所有项目通用。",
    comeBack: "运行之后回到这个标签页——看板会自己出现。",
  },
};

export default zh;
