// Layout A — the harness and model sit on the row itself, always on screen.
// Configuration → Agents, in the board UI's dialog. 1280x800.

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

function Caret({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke={color} strokeWidth="2.4"
      strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
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
          style={{
            background: r.on ? ACCENT_SOFT : "transparent",
            color: r.on ? ACCENT_DEEP : SOFT,
          }}>
          {r.icon(r.on ? ACCENT_DEEP : SOFT)}
          {r.label}
        </span>
      ))}
    </nav>
  );
}

function Cap({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[11px] font-[700] uppercase tracking-[0.08em]" style={{ color: SOFT }}>
      {children}
    </span>
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
          style={{
            borderColor: INK,
            background: PAPER,
            transform: on ? "translateX(22px)" : "translateX(3px)",
          }} />
      </span>
    </span>
  );
}

// A dropdown drawn as the pane's own control frame.
function Picker({ value, dim }: { value: string; dim?: boolean }) {
  return (
    <span className="flex w-full items-center justify-between rounded-[10px] border-[1.5px] px-3 py-2 text-[13px]"
      style={{ borderColor: INK, background: PAPER, color: dim ? SOFT : INK, opacity: dim ? 0.75 : 1 }}>
      <span className="truncate">{value}</span>
      <Caret color={SOFT} />
    </span>
  );
}

function Box({ value, placeholder, dim }: { value?: string; placeholder?: string; dim?: boolean }) {
  return (
    <span className="block w-full truncate rounded-[10px] border-[1.5px] px-3 py-2 text-[13px]"
      style={{
        borderColor: INK,
        background: PAPER,
        color: value ? (dim ? SOFT : INK) : "rgba(86,85,80,0.6)",
        opacity: dim ? 0.75 : 1,
      }}>
      {value || placeholder}
    </span>
  );
}

function Row({
  name, owns, calledOn, on, harness, model, modelPlaceholder,
}: {
  name: string;
  owns: string;
  calledOn: string;
  on: boolean;
  harness: string;
  model?: string;
  modelPlaceholder: string;
}) {
  const dim = !on;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-[800]" style={{ color: dim ? SOFT : INK }}>{name}</p>
          <p className="mt-0.5 text-[12px] leading-relaxed" style={{ color: SOFT }}>{owns}</p>
          <p className="text-[12px] leading-relaxed" style={{ color: SOFT }}>{calledOn}</p>
        </div>
        <Switch on={on} />
      </div>

      {/* The two controls, side by side, under the words that name the agent.
          Nothing opens or closes: what this agent runs on is on screen whenever
          the pane is. */}
      <div className="flex gap-3">
        <span className="min-w-0 flex-1">
          <Cap>Harness</Cap>
          <span className="mt-1.5 block"><Picker value={harness} dim={dim} /></span>
        </span>
        <span className="min-w-0 flex-1">
          <Cap>Model</Cap>
          <span className="mt-1.5 block"><Box value={model} placeholder={modelPlaceholder} dim={dim} /></span>
        </span>
      </div>
    </div>
  );
}

export default function A() {
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
                harness="Same as the board — Claude Code"
                modelPlaceholder="Same as the board — claude-opus-5"
              />

              <div className="border-t" style={{ borderColor: "rgba(36,35,31,0.12)" }} />

              <Row
                name="technology-selection"
                owns="the library, tool, or service a card leans on — the candidates weighed, one recommended"
                calledOn="called on a card that leans on an outside library, tool or service"
                on={false}
                harness="Codex"
                model="gpt-5.3-codex"
                modelPlaceholder="Same as the board"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
