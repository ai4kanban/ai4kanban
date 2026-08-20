// Layout B — each row says in one line what it runs on, and that line opens into
// the two controls. Configuration → Agents, in the board UI's dialog. 1280x800.
//
// Drawn with the first agent's line open (the user has just pressed Change) and
// the second closed, so the screen shows both states of the same line.

const INK = "#24231f";
const SOFT = "#565550";
const PAPER = "#ffffff";
const WASH = "#f4f3ef";
const ACCENT = "#dd4f1e";
const ACCENT_DEEP = "#b83a12";
const ACCENT_SOFT = "#f7ddce";

function Terminal({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke={color} strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
      <path d="M4 17l6-5-6-5" />
      <path d="M12 19h8" />
    </svg>
  );
}

function Users({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke={color} strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function Code({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke={color} strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
      <path d="M16 18l6-6-6-6" />
      <path d="M8 6l-6 6 6 6" />
    </svg>
  );
}

function Caret({ color, open }: { color: string; open?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke={color} strokeWidth="2.4"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ flex: "0 0 auto", transform: open ? "rotate(180deg)" : "none" }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function Sidebar() {
  const rows: { label: string; icon: (c: string) => React.ReactNode; on?: boolean }[] = [
    { label: "Harness", icon: (c) => <Terminal color={c} /> },
    { label: "Agents", icon: (c) => <Users color={c} />, on: true },
    { label: "Skill", icon: (c) => <Code color={c} /> },
  ];
  return (
    <nav className="flex w-[150px] shrink-0 flex-col gap-1 border-r p-3"
      style={{ borderColor: "rgba(36,35,31,0.12)", background: WASH }}>
      {rows.map((r) => (
        <span key={r.label}
          className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-[13px] font-[700]"
          style={{ background: r.on ? ACCENT_SOFT : "transparent", color: r.on ? ACCENT_DEEP : SOFT }}>
          {r.icon(r.on ? ACCENT_DEEP : SOFT)}
          {r.label}
        </span>
      ))}
    </nav>
  );
}

function Switch({ on }: { on: boolean }) {
  return (
    <span className="flex shrink-0 items-center gap-2 pt-0.5">
      <span className="text-[11px] font-[700] uppercase leading-none tracking-[0.04em]" style={{ color: SOFT }}>
        {on ? "on" : "off"}
      </span>
      <span className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-[1.5px]"
        style={{ borderColor: INK, background: on ? ACCENT : WASH }}>
        <span className="inline-block size-[16px] rounded-full border"
          style={{ borderColor: INK, background: PAPER, transform: on ? "translateX(22px)" : "translateX(3px)" }} />
      </span>
    </span>
  );
}

function QuietBtn({ children, dim }: { children: React.ReactNode; dim?: boolean }) {
  return (
    <span className="shrink-0 rounded-[8px] border-[1.5px] px-3 py-1 text-[12px] font-[700]"
      style={{ borderColor: INK, background: PAPER, color: dim ? SOFT : INK, opacity: dim ? 0.75 : 1 }}>
      {children}
    </span>
  );
}

function Cap({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[11px] font-[700] uppercase tracking-[0.08em]" style={{ color: SOFT }}>
      {children}
    </span>
  );
}

function Picker({ value }: { value: string }) {
  return (
    <span className="flex w-full items-center justify-between rounded-[10px] border-[1.5px] px-3 py-2 text-[13px]"
      style={{ borderColor: INK, background: PAPER, color: INK }}>
      <span className="truncate">{value}</span>
      <Caret color={SOFT} />
    </span>
  );
}

function Box({ value, placeholder }: { value?: string; placeholder?: string }) {
  return (
    <span className="block w-full truncate rounded-[10px] border-[1.5px] px-3 py-2 text-[13px]"
      style={{ borderColor: INK, background: PAPER, color: value ? INK : "rgba(86,85,80,0.6)" }}>
      {value || placeholder}
    </span>
  );
}

function Row({
  name, owns, calledOn, on, runsOn, own, open,
}: {
  name: string;
  owns: string;
  calledOn: string;
  on: boolean;
  /** The one line: what this agent will actually run on. */
  runsOn: string;
  /** Is that its own pick, or the board's? */
  own: boolean;
  open?: boolean;
}) {
  const dim = !on;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-[800]" style={{ color: dim ? SOFT : INK }}>{name}</p>
          <p className="mt-0.5 text-[12px] leading-relaxed" style={{ color: SOFT }}>{owns}</p>
          <p className="text-[12px] leading-relaxed" style={{ color: SOFT }}>{calledOn}</p>
        </div>
        <Switch on={on} />
      </div>

      {/* The line. Closed it is one sentence and a button; open it grows the two
          controls under it, inside the same inset. A switched-off row keeps the
          line, greyed with the rest. */}
      <div className="rounded-[10px] border px-3 py-2"
        style={{
          borderColor: "rgba(36,35,31,0.22)",
          background: WASH,
          opacity: dim ? 0.7 : 1,
        }}>
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-[12px]" style={{ color: SOFT }}>
            Runs on <span className="font-[700]" style={{ color: dim ? SOFT : INK }}>{runsOn}</span>
            {own ? " — its own" : " — the board's"}
          </p>
          <span className="flex shrink-0 items-center gap-2">
            {own && <QuietBtn dim={dim}>Use the board&rsquo;s</QuietBtn>}
            <span className="flex items-center gap-1.5 text-[12px] font-[700]" style={{ color: dim ? SOFT : INK }}>
              Change <Caret color={SOFT} open={open} />
            </span>
          </span>
        </div>

        {open && (
          <div className="mt-3 flex gap-3 border-t pt-3" style={{ borderColor: "rgba(36,35,31,0.14)" }}>
            <span className="min-w-0 flex-1">
              <Cap>Harness</Cap>
              <span className="mt-1.5 block"><Picker value="Same as the board — Claude Code" /></span>
            </span>
            <span className="min-w-0 flex-1">
              <Cap>Model</Cap>
              <span className="mt-1.5 block"><Box placeholder="Same as the board — claude-opus-5" /></span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function B() {
  return (
    <div className="flex h-[800px] w-[1280px] items-center justify-center font-sans" style={{ background: "#f7f7f4" }}>
      <div className="flex h-[640px] w-[720px] flex-col overflow-hidden rounded-[16px] border-[1.5px]"
        style={{ borderColor: INK, background: PAPER, boxShadow: `3px 3px 0 0 ${INK}` }}>
        <div className="flex shrink-0 items-center justify-between border-b-[1.5px] px-5 py-3" style={{ borderColor: INK }}>
          <h2 className="text-[15px] font-extrabold tracking-[-0.02em]" style={{ color: INK }}>Configuration</h2>
          <span className="text-[16px]" style={{ color: SOFT }}>×</span>
        </div>

        <div className="flex min-h-0 flex-1">
          <Sidebar />

          <div className="min-h-0 flex-1 overflow-hidden p-6">
            <p className="text-[13px] leading-relaxed" style={{ color: SOFT }}>
              A spec agent fills one part of a card&rsquo;s spec in a run of its own. They are called
              when a card is being planned, never when it is being built. Each one runs on the
              board&rsquo;s harness unless you give it one here.
            </p>

            <div className="mt-5 flex flex-col gap-5">
              <Row
                name="ui-design"
                owns="the screen a card changes — the layout drawn as options, one of them recommended"
                calledOn="called on a card that changes or adds a screen the user sees"
                on
                runsOn="Claude Code · claude-opus-5"
                own={false}
                open
              />

              <div className="border-t" style={{ borderColor: "rgba(36,35,31,0.12)" }} />

              <Row
                name="technology-selection"
                owns="the library, tool, or service a card leans on — the candidates weighed, one recommended"
                calledOn="called on a card that leans on an outside library, tool or service"
                on={false}
                runsOn="Codex · gpt-5.3-codex"
                own
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
