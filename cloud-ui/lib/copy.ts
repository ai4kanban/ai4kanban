// Every word these pages say that the board itself does not.
//
// The screens are `kanban-ui`'s and bring their own copy with them (`kanban-ui/i18n/`), so
// what is left here is the frame around them: the way back, the sign-out, and the two
// answers a read can give. English is the source; the Chinese follows the board's own
// wording rules (`kanban-ui/i18n/index.ts`).

import type { Language } from "@/lib/format/machine/types";

export interface HostedCopy {
  /** The tab's title. The board's own name is never in it — a link preview must carry
   *  nothing of a board a reader may not be signed in for. */
  title: string;
  backToBoard: string;
  signOut: string;
  signIn: string;
  /** The page a sign-out lands on. It says so and offers the way back in — it must not send
   *  the reader into a sign-in, or Sign out would undo itself. */
  signedOut: string;
  /** The page a sign-in that did not finish lands on — declined at the consent screen, or a
   *  code Auth would not trade. Same shape: the way back in is on it, and it is not one. */
  signInFailed: string;
  /** Every refusal, in one sentence: signed out, no claim on the workspace, a workspace
   *  that was deleted, and an id nobody ever had. */
  refused: string;
  /** The service could not answer. Never the sentence above — a member's live board must
   *  never be reported as gone. */
  unavailable: string;
  noSuchCard: string;
  noWorkspace: string;
  chooseWorkspace: string;
  readOnly: string;
  /** The way into the app, offered on a card page (#364). A machine holding a copy of this
   *  workspace opens the card; one without the app does nothing, which is why it is an offer
   *  rather than a redirect. */
  openInApp: string;
  /** A press the service could not answer. Never a refusal — nothing reached the service, and
   *  the decision is unmade rather than rejected. */
  pressUnavailable: string;
  /** A press refused with no words of its own: the browser session ran out, or this page is
   *  showing a card that has moved on. The redraw that follows says what it is now. */
  pressRefused: string;
}

const en: HostedCopy = {
  title: "AI4Kanban",
  backToBoard: "Board",
  signOut: "Sign out",
  signIn: "Sign in",
  signedOut: "Signed out of this browser.",
  signInFailed: "That sign-in did not finish. Try again.",
  refused:
    "This board is not readable by this account. Sign in as an account it belongs to, or ask its owner for the link.",
  unavailable: "The board could not be read just now. Try again shortly.",
  noSuchCard: "This board has no card with that number.",
  noWorkspace: "No workspace yet. Make one in the AI4Kanban app, and it opens here.",
  chooseWorkspace: "Your workspaces",
  readOnly: "Read-only",
  openInApp: "Open in the app",
  pressUnavailable: "That could not be sent just now. Nothing was decided — try again shortly.",
  pressRefused: "This card has moved on. Reload to see where it stands.",
};

const zh: HostedCopy = {
  title: "AI4Kanban",
  backToBoard: "看板",
  signOut: "退出登录",
  signIn: "登录",
  signedOut: "已退出此浏览器的登录。",
  signInFailed: "登录未完成，请重试。",
  refused: "当前账号无法读取该看板。请使用其所属账号登录，或向其所有者索取链接。",
  unavailable: "暂时无法读取该看板，请稍后重试。",
  noSuchCard: "该看板没有此编号的任务卡。",
  noWorkspace: "尚无工作区。在 AI4Kanban 应用中创建后，即可在此打开。",
  chooseWorkspace: "你的工作区",
  readOnly: "只读",
  openInApp: "在应用中打开",
  pressUnavailable: "暂时无法提交，尚未做出决定，请稍后重试。",
  pressRefused: "该任务卡已发生变化，请刷新查看当前状态。",
};

export const getHostedCopy = (language: Language): HostedCopy => (language === "zh" ? zh : en);
