// Layout C — the row opens a page of its own, drawn with the Harness pane's own
// cards. Configuration → Agents → ui-design, in the board UI's dialog. 1280x800.
//
// The list behind this is today's rows, each with one line saying what it runs on
// and a chevron into this page. This draws the page, since that is the new screen.

const INK = "#24231f";
const SOFT = "#565550";
const PAPER = "#ffffff";
const WASH = "#f4f3ef";
const ACCENT = "#dd4f1e";
const ACCENT_DEEP = "#b83a12";
const ACCENT_SOFT = "#f7ddce";
const FRAME = "rgba(36,35,31,0.22)";

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

function Caret({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke={color} strokeWidth="2.4"
      strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function Back({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke={color} strokeWidth="2.4"
      strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

// Stand-in marks for the harnesses — the real pane draws each one's own logo.
function Mark({ shape, color }: { shape: "burst" | "hex" | "square" | "wave"; color: string }) {
  if (shape === "burst") {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" stroke={color} strokeWidth="2" strokeLinecap="round">
        <path d="M12 3v18M3 12h18M6 6l12 12M18 6L6 18" />
      </svg>
    );
  }
  if (shape === "hex") {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round">
        <path d="M12 3l7.5 4.5v9L12 21l-7.5-4.5v-9z" />
      </svg>
    );
  }
  if (shape === "square") {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round">
        <rect x="4" y="4" width="16" height="16" rx="3" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <path d="M3 14c3-6 6 6 9 0s6-6 9 0" />
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
    <span className="flex shrink-0 items-center gap-2">
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

function Cap({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[11px] font-[700] uppercase tracking-[0.08em]" style={{ color: SOFT }}>
      {children}
    </span>
  );
}

// One harness card, the Harness pane's own square. The first card is the board's
// pick — picking it is how an agent goes back to inheriting.
function HarnessCard({
  label, note, shape, on,
}: {
  label: string;
  note?: string;
  shape?: "burst" | "hex" | "square" | "wave";
  on?: boolean;
}) {
  return (
    <span className="flex flex-col items-center gap-2 rounded-[12px] border-[1.5px] px-2 pb-2.5 pt-4"
      style={{
        borderColor: on ? ACCENT_DEEP : FRAME,
        background: PAPER,
        boxShadow: `3px 3px 0 0 ${INK}`,
      }}>
      <span className="flex items-center justify-center rounded-[9px]"
        style={{ width: 38, height: 38, background: on ? ACCENT_SOFT : WASH }}>
        {shape ? <Mark shape={shape} color={INK} /> : (
          <span className="text-[16px] font-[800]" style={{ color: on ? ACCENT_DEEP : SOFT }}>=</span>
        )}
      </span>
      <span className="text-[12px] font-[800]" style={{ color: INK }}>{label}</span>
      {note && (
        <span className="-mt-1 text-[10px] font-[700] uppercase leading-none tracking-[0.04em]" style={{ color: SOFT }}>
          {note}
        </span>
      )}
    </span>
  );
}

export default function C() {
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
            {/* Back to the list of agents. */}
            <span className="flex items-center gap-1.5 text-[12px] font-[700]" style={{ color: SOFT }}>
              <Back color={SOFT} /> Agents
            </span>

            <div className="mt-3 flex items-start justify-between gap-4">
              <div>
                <p className="text-[14px] font-[800]" style={{ color: INK }}>ui-design</p>
                <p className="mt-0.5 text-[12px] leading-relaxed" style={{ color: SOFT }}>
                  the screen a card changes — the layout drawn as options, one of them recommended
                </p>
                <p className="text-[12px] leading-relaxed" style={{ color: SOFT }}>
                  called on a card that changes or adds a screen the user sees
                </p>
              </div>
              <Switch on />
            </div>

            <div className="mt-4 border-t pt-4" style={{ borderColor: "rgba(36,35,31,0.12)" }}>
              <Cap>What it runs on</Cap>
              {/* The Harness pane's grid, with the board's pick as the first card. */}
              <div className="mt-2 grid grid-cols-4 gap-2">
                <HarnessCard label="Board's" note="Claude Code" on />
                <HarnessCard label="Claude Code" shape="burst" />
                <HarnessCard label="Codex" shape="hex" />
                <HarnessCard label="Cursor" shape="square" />
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2">
                <HarnessCard label="OpenCode" shape="wave" />
              </div>
            </div>

            <div className="mt-4 border-t pt-4" style={{ borderColor: "rgba(36,35,31,0.12)" }}>
              <Cap>Model</Cap>
              <span className="mt-1.5 flex w-full items-center justify-between rounded-[10px] border-[1.5px] px-3 py-2 text-[13px]"
                style={{ borderColor: INK, background: PAPER, color: "rgba(86,85,80,0.6)" }}>
                <span className="truncate">Same as the board — claude-opus-5</span>
                <Caret color={SOFT} />
              </span>
              <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: SOFT }}>
                Leave it empty and this agent runs the model the board is set to.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
