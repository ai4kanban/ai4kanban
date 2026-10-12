import { FiChevronDown, FiEdit3, FiTrash2 } from "react-icons/fi";

// Pieces of the draft-first review page (draft-first/page/), drawn in React for the
// /draft-first figures. The sample is the commit-message task in draft-first/test/fixture.
// The review page itself speaks Chinese and English only, so the other languages draw it in English.

export type Lang = "zh" | "en";

export const UI = {
  zh: {
    confirmed: "已确认",
    note: "批注",
    remove: "删除",
    undo: "撤销",
    deleted: (l: string) => `已删除「${l}」`,
    notePlaceholder: "写下要改的地方…",
    doneTitle: "已确认，agent 还没有开始构建",
    doneBody: "回到 Claude Code 或 Codex，告诉 agent 继续。删除了 1 份草稿，写入了 3 条批注。",
    contract: "合约文件",
  },
  en: {
    confirmed: "Confirmed",
    note: "Note",
    remove: "Delete",
    undo: "Undo",
    deleted: (l: string) => `Deleted “${l}”`,
    notePlaceholder: "What should change…",
    doneTitle: "Confirmed — the agent hasn't started building",
    doneBody: "Go back to Claude Code or Codex and tell the agent to go on. 1 draft deleted, 3 notes added.",
    contract: "Contract",
  },
};

export type ReviewUi = (typeof UI)[Lang];

export const DOC = {
  zh: {
    title: "AI 生成 commit message",
    d1: "设置页长什么样",
    a: "A：单页表单",
    b: "B：分步向导",
    noteA: "语言默认跟随系统",
    in1: "在 parseArgs 中新增 --dry-run 参数",
    s: { head: "Commit message", model: "模型", lang: "语言", langV: "跟随系统", save: "保存" },
  },
  en: {
    title: "AI-written commit messages",
    d1: "How the settings page looks",
    a: "A: One-page form",
    b: "B: Step-by-step wizard",
    noteA: "Language defaults to the system's",
    in1: "Add a --dry-run flag to parseArgs",
    s: { head: "Commit message", model: "Model", lang: "Language", langV: "System", save: "Save" },
  },
};

export const PROMPT = `You write one git commit message for the staged diff below.
- Subject: imperative mood, at most 50 characters, no trailing period.
- Body: only when the change needs a reason; wrap at 72 characters.
Return the message only.`;
export const OUT1 = "Add a --dry-run flag to parseArgs";

export const HAIR = "border-[color-mix(in_srgb,var(--color-nb-ink)_12%,transparent)]";
const QUIET =
  "inline-flex h-7 items-center gap-1.5 rounded-[8px] bg-nb-wash px-2.5 text-[12px] font-[700] text-nb-ink";

export function Chip({ children, tone = "accent" }: { children: React.ReactNode; tone?: "accent" | "mint" }) {
  const c = {
    accent: ["var(--color-nb-accent-soft)", "var(--color-nb-accent-deep)"],
    mint: ["var(--color-nb-mint-soft)", "var(--color-nb-mint-ink)"],
  }[tone];
  return (
    <span className="nb-chip" style={{ background: c[0], color: c[1] }}>
      {children}
    </span>
  );
}

// The user's own app, as the agent drafted it: neutral, not ours.
export function SettingsDraft({ lang }: { lang: Lang }) {
  const s = DOC[lang].s;
  return (
    <div className="flex justify-center bg-nb-wash" style={{ padding: 20 }}>
      <div
        className="overflow-hidden rounded-[6px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
        style={{ width: 640, fontFamily: "Helvetica, Arial, sans-serif" }}
      >
        <div className="flex h-9 items-center gap-1.5 border-b border-[#e5e7eb] px-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#e5e7eb]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#e5e7eb]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#e5e7eb]" />
        </div>
        <div style={{ padding: 28 }}>
          <div className="text-[15px] font-[600] text-[#111827]">{s.head}</div>
          <div className="mt-4 flex flex-col gap-3">
            {[
              [s.model, "claude-sonnet-5-5"],
              [s.lang, s.langV],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center gap-3 text-[12px] text-[#374151]">
                <span style={{ width: 90 }}>{k}</span>
                <span className="flex h-8 flex-1 items-center justify-between rounded-[5px] border border-[#d1d5db] px-2.5 text-[#111827]">
                  {v}
                  <FiChevronDown className="text-[#9ca3af]" />
                </span>
              </div>
            ))}
          </div>
          <div className="mt-5 flex justify-end">
            <span className="rounded-[5px] bg-[#2563eb] px-3.5 py-1.5 text-[12px] font-[600] text-white">{s.save}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DraftHead({ label, src, tools, ui }: { label: string; src: string; tools: boolean; ui: ReviewUi }) {
  return (
    <div className="flex items-center gap-2.5 py-2">
      <Chip>{label}</Chip>
      <span className="truncate font-mono text-[11.5px] text-nb-ink-soft">{src}</span>
      {tools && (
        <span className="ml-auto flex shrink-0 gap-1.5">
          <span className={QUIET}>
            <FiEdit3 className="h-3 w-3" />
            {ui.note}
          </span>
          <span className={QUIET} style={{ color: "var(--color-nb-peach-ink)" }}>
            <FiTrash2 className="h-3 w-3" />
            {ui.remove}
          </span>
        </span>
      )}
    </div>
  );
}

export function Note({ text, editing, ui }: { text: string; editing?: boolean; ui: ReviewUi }) {
  return (
    <div
      className={`mt-2 flex items-start gap-2 rounded-[9px] px-3 py-2 text-[13px] leading-[19px] ${
        editing ? "border border-[color-mix(in_srgb,var(--color-nb-ink)_25%,transparent)] bg-nb-paper outline-2 outline-nb-accent" : "bg-nb-wash"
      }`}
    >
      <FiEdit3 className="mt-[3px] h-3 w-3 shrink-0 text-nb-ink-soft" />
      <span className="flex-1 text-nb-ink">
        {text || <span className="text-nb-ink-soft">{ui.notePlaceholder}</span>}
        {editing && <span className="ml-px inline-block h-[14px] w-px translate-y-[2px] bg-nb-ink" />}
      </span>
      <span className="text-[11px] font-[700] uppercase tracking-[0.06em] text-nb-ink-soft">{ui.note}</span>
    </div>
  );
}
