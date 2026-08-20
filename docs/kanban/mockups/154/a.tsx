// Layout A — what a card holds up is one more column in the meta band, sitting
// beside "Blocked by". The card page of the board UI, 1280x800.

const INK = "#24231f";
const SOFT = "#565550";
const DEEP = "#b83a12";
const WASH = "#f4f3ef";
const PEACH_SOFT = "#fbe9dd";
const PEACH_INK = "#8a4a28";
const SKY_SOFT = "#e6f1fb";
const SKY_INK = "#2c5c86";
const LILAC_SOFT = "#efe9fb";
const LILAC_INK = "#5a3f92";

function Lock({ open, color }: { open?: boolean; color: string }) {
  return (
    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke={color} strokeWidth="2.4"
      strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      {open ? <path d="M7 11V7a5 5 0 0 1 9.9-1" /> : <path d="M7 11V7a5 5 0 0 1 10 0v4" />}
    </svg>
  );
}

function Flag({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke={color} strokeWidth="2.4"
      strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <path d="M4 22v-7" />
    </svg>
  );
}

function Chip({ bg, fg, children }: { bg: string; fg: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-[6px] px-[6px] py-[2.5px] text-[10px] font-[700] uppercase leading-none tracking-[0.04em]"
      style={{ background: bg, color: fg }}
    >
      {children}
    </span>
  );
}

function Cap({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-[700] uppercase tracking-[0.08em]" style={{ color: SOFT }}>
      {children}
    </span>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Cap>{label}</Cap>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function Bar({ done, total }: { done: number; total: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span style={{ display: "block", width: 90, height: 4, borderRadius: 999, overflow: "hidden", background: "rgba(36,35,31,0.12)" }}>
        <span style={{ display: "block", height: "100%", width: `${(done / total) * 100}%`, background: "#dd4f1e" }} />
      </span>
      <span className="text-[10.5px] font-[700] tabular-nums" style={{ color: SOFT }}>{done}/{total}</span>
    </span>
  );
}

function Rail() {
  const open = [
    { id: 88, title: "Let a release be planned from the board", on: true },
    { id: 154, title: "Show what a card unblocks", on: false },
    { id: 63, title: "One place that reads the board's files", on: false },
  ];
  return (
    <div className="flex w-[216px] shrink-0 flex-col py-2 pl-3 pr-1">
      <div className="mb-2 flex items-center gap-2 rounded-[9px] border-[1.5px] px-2.5 py-1.5"
        style={{ borderColor: "rgba(36,35,31,0.18)", background: "#fff" }}>
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke={SOFT} strokeWidth="2.4" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
        </svg>
        <span className="text-[12px]" style={{ color: SOFT }}>Find a card</span>
      </div>
      <div className="flex items-center justify-between rounded-[9px] px-2.5 py-2">
        <span className="text-[12.5px] font-[700]">All cards</span>
        <span className="text-[11px] tabular-nums" style={{ color: SOFT }}>42</span>
      </div>
      <div className="mt-2 mb-1 px-2.5"><Cap>Open cards</Cap></div>
      {open.map((r) => (
        <div key={r.id}
          className="flex items-center gap-2 rounded-[9px] px-2.5 py-2"
          style={{ background: r.on ? "#fff" : undefined, boxShadow: r.on ? "inset 2.5px 0 0 0 #dd4f1e" : undefined }}>
          <span className="shrink-0 text-[11px] font-[800]" style={{ color: DEEP }}>#{r.id}</span>
          <span className="min-w-0 flex-1 truncate text-[12.5px]" style={{ color: r.on ? INK : SOFT, fontWeight: r.on ? 700 : 400 }}>
            {r.title}
          </span>
        </div>
      ))}
    </div>
  );
}

function TopBar() {
  return (
    <div className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-[7px]">
      <span className="flex h-7 w-7 items-center justify-center rounded-[8px] border-[1.5px] text-[13px] font-[800] text-white"
        style={{ borderColor: INK, background: "#dd4f1e", boxShadow: "2px 2px 0 0 " + INK }}>a</span>
      <span className="font-mono text-[12px]" style={{ color: SOFT }}>~/git/ai4kanban</span>
      <span className="ml-auto flex items-center gap-2">
        {["Goal", "0.7.0", "Progress", "Sessions"].map((t) => (
          <span key={t} className="flex h-7 items-center rounded-[8px] border-[1.5px] bg-white px-2.5 text-[12px] font-[600]"
            style={{ borderColor: INK, boxShadow: "2px 2px 0 0 " + INK }}>{t}</span>
        ))}
        <span className="flex h-7 items-center rounded-[8px] border-[1.5px] px-2.5 text-[12px] font-[700] text-white"
          style={{ borderColor: INK, background: "#dd4f1e", boxShadow: "2px 2px 0 0 " + INK }}>New task</span>
      </span>
    </div>
  );
}

function Toolbar() {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-[9px] border-[1.5px] px-3 py-2 text-[13px] font-[700] text-white"
        style={{ borderColor: INK, background: "#dd4f1e", boxShadow: "2px 2px 0 0 " + INK }}>▶ Implement</span>
      {["Refine", "Edit"].map((t) => (
        <span key={t} className="inline-flex items-center gap-1.5 rounded-[9px] border-[1.5px] bg-white px-3 py-2 text-[13px] font-[600]"
          style={{ borderColor: INK, boxShadow: "2px 2px 0 0 " + INK }}>{t}</span>
      ))}
      <span className="ml-auto inline-flex items-center gap-1.5 rounded-[9px] border-[1.5px] bg-white px-3 py-2 text-[13px] font-[600]"
        style={{ borderColor: DEEP, color: DEEP, boxShadow: "2px 2px 0 0 " + INK }}>Reject</span>
    </div>
  );
}

function Body() {
  return (
    <div className="text-[14px] leading-[22px]">
      <p className="mb-4">
        Planning a release means opening every card and setting its version by hand. The board already
        knows which cards are ready, so it can propose the list and you say yes.
      </p>
      <h2 className="mb-2 text-[16px] font-[800] tracking-[-0.01em]">Scope</h2>
      <ul className="mb-4 flex flex-col gap-1.5 pl-4">
        <li className="list-disc">Pick a release at the top of the board and see only its cards.</li>
        <li className="list-disc">Propose the next release from the cards that are ready.</li>
      </ul>
      <h2 className="mb-2 text-[16px] font-[800] tracking-[-0.01em]">Todo</h2>
      <ul className="flex flex-col gap-1.5" style={{ color: SOFT }}>
        <li>☑ Read the open releases from the board folder.</li>
        <li>☐ Draw the picker at the top of the board.</li>
      </ul>
    </div>
  );
}

export default function A() {
  return (
    <div className="flex h-[800px] w-[1280px] flex-col overflow-hidden font-sans" style={{ background: "#f7f7f4", color: INK }}>
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <Rail />
        <div className="min-w-0 flex-1 pl-1">
          <div className="h-full overflow-hidden rounded-tl-[14px] bg-white">
            <main className="mx-auto w-full max-w-[840px] px-6 py-6">
              <div className="mb-4 flex flex-wrap items-center gap-x-2.5 gap-y-2">
                <span className="shrink-0 text-[20px] font-[800]" style={{ color: DEEP }}>#88</span>
                <h1 className="text-[20px] font-[800] leading-tight tracking-[-0.02em]">
                  Let a release be planned from the board
                </h1>
              </div>

              <Toolbar />

              {/* the meta band — "Holding up" is a column of it like any other */}
              <div className="mb-4 flex flex-wrap items-start gap-x-7 gap-y-3 rounded-[14px] border-[1.5px] bg-white px-4 py-3"
                style={{ borderColor: INK }}>
                <Meta label="Track"><Chip bg={WASH} fg={SOFT}>features</Chip></Meta>
                <Meta label="Modules">
                  <Chip bg={LILAC_SOFT} fg={LILAC_INK}>skill</Chip>
                  <Chip bg={LILAC_SOFT} fg={LILAC_INK}>local-ui</Chip>
                </Meta>
                <Meta label="Release"><Chip bg={WASH} fg={SOFT}>0.7.0 ▾</Chip></Meta>
                <Meta label="Priority"><Chip bg={PEACH_SOFT} fg={PEACH_INK}><Flag color={PEACH_INK} />high ▾</Chip></Meta>
                <Meta label="ROI">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-[700] uppercase tracking-[0.04em]" style={{ color: SOFT }}>
                    <span style={{ display: "block", width: 5, height: 5, borderRadius: 999, background: "#7fb4e0" }} />
                    med ▾
                  </span>
                </Meta>
                <Meta label="Todos"><Bar done={2} total={6} /></Meta>
                <Meta label="Blocked by"><Chip bg={PEACH_SOFT} fg={PEACH_INK}>#63</Chip></Meta>
                <Meta label="Holding up">
                  <Chip bg={SKY_SOFT} fg={SKY_INK}><Lock open color={SKY_INK} />#201</Chip>
                  <Chip bg={SKY_SOFT} fg={SKY_INK}><Lock open color={SKY_INK} />#202</Chip>
                  <Chip bg={SKY_SOFT} fg={SKY_INK}><Lock open color={SKY_INK} />#233</Chip>
                </Meta>
              </div>

              <Body />
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
