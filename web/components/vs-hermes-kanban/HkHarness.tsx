import type { ReactNode } from "react";
import { FiCheck, FiX } from "react-icons/fi";
import { SiClaudecode, SiCursor } from "react-icons/si";
import { SectionHeading } from "../SectionHeading";
import { HermesMark } from "./HermesMark";
import { panelStatic } from "../styles";

// The harness-compatibility split as a single support matrix: one logo bar of
// agents as column headers, then a check/cross row per board. The vertical
// alignment is the point — the two rows differ in exactly one column, and that
// column is the whole argument.

// OpenClaw's official pixel-lobster mark, pulled from the openclaw repo's
// docs/assets — an <img> keeps its own palette, like the Hermes mark.
function OpenClawMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/openclaw-lobster.svg"
      alt=""
      width={24}
      height={24}
      className={`inline-block shrink-0 ${className}`}
    />
  );
}

// react-icons has no Codex mark, so the OpenAI blossom is inlined.
function OpenAiMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.8956zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  );
}

// Brand-colored marks: Anthropic's coral for Claude Code; the OpenAI and
// Cursor marks are white-on-dark by their own brand guides; OpenClaw and
// Hermes ship their own colors as image assets. Each icon is a render fn so the
// matrix can size it big (h-6) and the mobile chips small (h-4) from one source.
const AGENTS: { name: string; icon: (className: string) => ReactNode }[] = [
  { name: "Claude Code", icon: (c) => <SiClaudecode className={`${c} text-[#D97757]`} /> },
  { name: "Codex", icon: (c) => <OpenAiMark className={`${c} text-white`} /> },
  { name: "Cursor", icon: (c) => <SiCursor className={`${c} text-white`} /> },
  { name: "OpenClaw", icon: (c) => <OpenClawMark className={c} /> },
  { name: "Hermes", icon: (c) => <HermesMark className={c} /> },
];

// The two boards, as data — desktop renders them as matrix rows, mobile as
// stacked chip groups, but the support rule lives in one place either way.
const BOARDS: {
  tag: ReactNode;
  label: string;
  sub: string;
  supports: (name: string) => boolean;
}[] = [
  { tag: "🗂️", label: "AI4Kanban", sub: "any file-reading agent", supports: () => true },
  {
    tag: <HermesMark className="h-4 w-4" />,
    label: "Hermes Kanban",
    sub: "Hermes only",
    supports: (name) => name === "Hermes",
  },
];

const GRID = "grid grid-cols-[minmax(5.5rem,1.3fr)_repeat(5,1fr)] items-center";

function Mark({ supported }: { supported: boolean }) {
  return (
    <span
      className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full ${
        supported ? "bg-growth/15" : "bg-[#f85149]/[0.08]"
      }`}
    >
      {supported ? (
        <FiCheck className="h-4 w-4 text-growth" aria-label="supported" />
      ) : (
        <FiX className="h-4 w-4 text-[#f85149]/60" aria-label="not supported" />
      )}
    </span>
  );
}

function BoardRow({ tag, label, sub, supports }: (typeof BOARDS)[number]) {
  return (
    <div className={`${GRID} px-2 py-3.5 sm:px-4`}>
      <div className="pr-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm" aria-hidden="true">
            {tag}
          </span>
          <span className="text-sm font-semibold text-ink">{label}</span>
        </div>
        <p className="mt-0.5 text-xs text-muted">{sub}</p>
      </div>
      {AGENTS.map((a) => (
        <div key={a.name} className={supports(a.name) ? "" : "opacity-70"}>
          <Mark supported={supports(a.name)} />
        </div>
      ))}
    </div>
  );
}

// Mobile view: agents don't fit as six columns on a phone, so each board
// becomes a heading plus a wrap of agent chips — green + check when supported,
// dimmed + cross when not. The skill's all-green vs. Hermes Kanban's lone-green
// carries the same one-difference argument the matrix makes.
function BoardChips({ tag, label, sub, supports }: (typeof BOARDS)[number]) {
  return (
    <div className="px-3 py-4">
      <div className="flex flex-wrap items-baseline gap-x-1.5">
        <span className="text-sm" aria-hidden="true">
          {tag}
        </span>
        <span className="text-sm font-semibold text-ink">{label}</span>
        <span className="text-xs text-muted">· {sub}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {AGENTS.map((a) => {
          const ok = supports(a.name);
          return (
            <span
              key={a.name}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs ${
                ok
                  ? "border-growth/30 bg-growth/10 text-ink"
                  : "border-border bg-code text-muted opacity-70"
              }`}
            >
              {a.icon("h-4 w-4")}
              <span>{a.name}</span>
              {ok ? (
                <FiCheck className="h-3.5 w-3.5 text-growth" aria-label="supported" />
              ) : (
                <FiX className="h-3.5 w-3.5 text-[#f85149]/60" aria-label="not supported" />
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function HkHarness() {
  return (
    <section className="mt-24">
      <SectionHeading num="02" eyebrow="Harness support" title="Which agents can run the board?" />
      <p className="text-ink">
        The clearest single difference. The skill&apos;s board is plain files, so{" "}
        <span className="font-semibold">any agent that can read a repo can run it</span>{" "}
        — including Hermes itself. Hermes Kanban&apos;s board sits behind the
        runtime&apos;s{" "}
        <code className="rounded bg-code px-1 py-0.5 text-[0.85em]">kanban_*</code>{" "}
        tools, so only Hermes can.
      </p>

      <div className={`${panelStatic} mt-6 overflow-hidden`}>
        {/* Matrix — aligned columns land only where there's room for six of them. */}
        <div className="hidden divide-y-2 divide-border sm:block">
          <div className={`${GRID} bg-code px-2 py-4 sm:px-4`}>
            <div />
            {AGENTS.map((a) => (
              <div key={a.name} className="flex flex-col items-center gap-1.5">
                {a.icon("h-6 w-6")}
                <span className="text-center text-[0.7rem] font-medium leading-tight text-muted">
                  {a.name}
                </span>
              </div>
            ))}
          </div>
          {BOARDS.map((b) => (
            <BoardRow key={b.label} {...b} />
          ))}
        </div>

        {/* Phone — stacked chip groups, one per board. */}
        <div className="divide-y-2 divide-border sm:hidden">
          {BOARDS.map((b) => (
            <BoardChips key={b.label} {...b} />
          ))}
        </div>
      </div>

      <p className="mt-3 text-sm text-muted">
        …and the skill&apos;s row keeps going — Windsurf, OpenCode, Gemini CLI,
        anything that reads files. Hermes Kanban has no way in for other agents.
      </p>
    </section>
  );
}
