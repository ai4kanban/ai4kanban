// The panel's words, zh and en side by side. Idea and connection words are web/src/i18n.ts's own.

const ZH = {
  nav: { ideas: '想法', chats: '对话', projects: '项目', connections: '连接' },
  synced: '已同步',
  unsynced: '未同步',
  placeholder: '要做的事，比如「给官网加一个定价页」……',
  send: '发给 Claude',
  acceptance: '验收',
  discard: '丢弃',
  workflow: '工作流',
  start: '发起',
  started: '已发起',
  busy: 'Claude 正在更新想法，完成后再发起。',
  offline: '网络已断开，想法停在上次同步的版本。',
  conflict: '想法刚被更新，已显示最新版本，请确认后再发起。',
  retry: '重试',
  limit: '进行中的任务已达套餐上限。移除不再需要的任务，或升级后再发起。',
  startFailed: '没能发起，请重试。',
  sendFailed: '没能发给 Claude，内容已保留，请重试。',
  notReady: '运行任务的 agent 未就绪，请在「连接」里处理后再发起。',
  ideaCount: (n: number) => (n ? `${n} 个想法` : '还没有想法'),
  thisChat: '本会话',
  earlierChats: '之前的会话',
  noChats: '还没有对话',
  back: '返回本会话',
  thisDir: '本目录',
  added: '已添加',
  addDir: '添加为项目',
  signInAdd: '登录并添加为项目',
  signingIn: '正在等待浏览器登录…',
  openSignIn: '打开登录页',
  signInFailed: '登录未完成，请重试。',
  dirHint: '已登记的目录沿用原项目，否则在个人工作空间新建同名项目。',
  bindHint: '可以新建项目，或绑定到这台电脑上还没有目录的已有项目。',
  bindHeading: '或绑定到已有项目',
  bind: '绑定',
  refused: {
    home: '不能添加主目录，请在项目目录中打开 Claude Code。',
    disk: '不能添加整个磁盘，请在项目目录中打开 Claude Code。',
    system: '这是系统目录，请在项目目录中打开 Claude Code。',
    missing: '找不到这个目录。',
    taken: '这个目录已属于另一个项目。',
  } as Record<string, string>,
  addedProjects: '已添加的项目',
  board: '看板',
  ready: '已就绪',
  signedOut: '未登录',
  notInstalled: '未安装',
  signedOutHint: (h: string) => `${h} 未登录。在这台电脑上执行：`,
  notInstalledHint: (h: string) => `${h} 未安装。在这台电脑上执行：`,
  recheck: '重新检测',
  checking: '正在检测…',
  justNow: '刚刚',
  minutesAgo: (n: number) => `${n} 分钟前`,
  hoursAgo: (n: number) => `${n} 小时前`,
  yesterday: '昨天',
  daysAgo: (n: number) => `${n} 天前`,
  opened: 'WildCrane 面板已打开。',
  needsMods: 'WildCrane 面板需要 Claude Code 2.1.287 或更高版本，并开启插件 Mod。',
  notHere: '请在终端或 Claude Desktop 中使用 WildCrane 面板。',
}

export type Copy = typeof ZH

const EN: Copy = {
  nav: { ideas: 'Ideas', chats: 'Chats', projects: 'Projects', connections: 'Connections' },
  synced: 'Synced',
  unsynced: 'Not synced',
  placeholder: 'What needs doing, e.g. “Add a pricing page to the website”…',
  send: 'Send to Claude',
  acceptance: 'Done when',
  discard: 'Discard',
  workflow: 'Workflow',
  start: 'Start',
  started: 'Started',
  busy: "Claude is updating the ideas. Start once it's done.",
  offline: "You're offline. The ideas stay at their last synced version.",
  conflict: 'The ideas just changed. This is the latest version; check it, then start.',
  retry: 'Retry',
  limit: "You've reached your plan's limit on tasks in progress. Remove one you no longer need, or upgrade.",
  startFailed: "Couldn't start it. Try again.",
  sendFailed: "Couldn't send it to Claude. Your text is kept; try again.",
  notReady: 'The agent that runs tasks isn’t ready. Fix it under Connections, then start.',
  ideaCount: (n) => (n ? `${n} idea${n > 1 ? 's' : ''}` : 'No ideas yet'),
  thisChat: 'This session',
  earlierChats: 'Earlier sessions',
  noChats: 'No chats yet',
  back: 'Back to this session',
  thisDir: 'This folder',
  added: 'Added',
  addDir: 'Add as project',
  signInAdd: 'Sign in and add as project',
  signingIn: 'Waiting for the browser…',
  openSignIn: 'Open the sign-in page',
  signInFailed: "Sign-in didn't finish. Try again.",
  dirHint: 'A registered folder keeps its project; otherwise a same-named project is created in your personal workspace.',
  bindHint: 'Create a project, or bind an existing one that has no folder on this computer.',
  bindHeading: 'Or bind an existing project',
  bind: 'Bind',
  refused: {
    home: "Your home folder can't be added. Open Claude Code in a project folder.",
    disk: "A whole disk can't be added. Open Claude Code in a project folder.",
    system: 'This is a system folder. Open Claude Code in a project folder.',
    missing: "This folder can't be found.",
    taken: 'This folder already belongs to another project.',
  },
  addedProjects: 'Added projects',
  board: 'Board',
  ready: 'Ready',
  signedOut: 'Signed out',
  notInstalled: 'Not installed',
  signedOutHint: (h) => `${h} is signed out. On this computer, run:`,
  notInstalledHint: (h) => `${h} isn't installed. On this computer, run:`,
  recheck: 'Check again',
  checking: 'Checking…',
  justNow: 'just now',
  minutesAgo: (n) => `${n} min ago`,
  hoursAgo: (n) => `${n} h ago`,
  yesterday: 'yesterday',
  daysAgo: (n) => `${n} days ago`,
  opened: 'The WildCrane panel is open.',
  needsMods: 'The WildCrane panel needs Claude Code 2.1.287 or later with plugin mods on.',
  notHere: 'Use the WildCrane panel in a terminal or Claude Desktop.',
}

export type Lang = 'zh' | 'en'

export const copyFor = (lang: Lang): Copy => (lang === 'zh' ? ZH : EN)

/** Claude Code's `language` setting first, then the system's. */
export function langOf(setting: unknown, system: string | undefined): Lang {
  if (typeof setting === 'string' && setting) return /^(zh|chinese)|中文/i.test(setting) ? 'zh' : 'en'
  return /^zh/i.test(system ?? '') ? 'zh' : 'en'
}

export function ago(c: Copy, at: string, now = Date.now()): string {
  const minutes = Math.floor((now - Date.parse(at)) / 60_000)
  if (!(minutes >= 1)) return c.justNow
  if (minutes < 60) return c.minutesAgo(minutes)
  if (minutes < 24 * 60) return c.hoursAgo(Math.floor(minutes / 60))
  const days = Math.floor(minutes / (24 * 60))
  return days === 1 ? c.yesterday : c.daysAgo(days)
}
