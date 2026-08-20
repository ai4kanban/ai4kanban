// Layout A — the diff as a second tab in the Sessions panel, beside the log.

const INK = "#24231f";
const SOFT = "#565550";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke={SOFT} strokeWidth="2" strokeLinecap="round"
      style={{ transform: open ? "rotate(90deg)" : "none" }}>
      <path d="M6 3l5 5-5 5" />
    </svg>
  );
}

function Counts({ plus, minus }: { plus: number; minus: number }) {
  return (
    <span className="flex shrink-0 items-center gap-2 font-mono text-[11px]">
      <span className="text-[#2f6b46]">+{plus}</span>
      <span className="text-[#8a4a28]">−{minus}</span>
    </span>
  );
}

function File({ name, plus, minus, open }: { name: string; plus: number; minus: number; open?: boolean }) {
  return (
    <div className="border-b border-[#24231f]/10 last:border-b-0">
      <div className="flex items-center gap-2 px-3 py-2">
        <Chevron open={!!open} />
        <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-[#24231f]">{name}</span>
        <Counts plus={plus} minus={minus} />
      </div>
      {open && (
        <div className="border-t border-[#24231f]/10 bg-[#f4f3ef] px-3 py-2 font-mono text-[11px] leading-[17px]">
          <div className="text-[#565550]">@@ -18,7 +18,12 @@</div>
          <div className="text-[#24231f]"> export function runDiff(dir: string) {"{"}</div>
          <div className="bg-[#e4f3ea] text-[#2f6b46]">+ if (!fs.existsSync(dir)) return {"{"} gone: true {"}"};</div>
          <div className="bg-[#e4f3ea] text-[#2f6b46]">+ const files = numstat(dir);</div>
          <div className="bg-[#fbe9dd] text-[#8a4a28]">− const files = [];</div>
          <div className="text-[#24231f]"> return {"{"} files {"}"};</div>
        </div>
      )}
    </div>
  );
}

export default function A() {
  return (
    <div className="flex h-[800px] w-[1280px] items-center justify-center bg-[#f7f7f4] font-sans">
      <div className="flex h-[640px] w-[880px] flex-col overflow-hidden rounded-[16px] border-[1.5px] border-[#24231f] bg-white shadow-[3px_3px_0_0_#24231f]">
        <div className="flex shrink-0 items-center justify-between border-b-[1.5px] border-[#24231f] px-5 py-3">
          <h2 className="text-[15px] font-extrabold tracking-[-0.02em] text-[#24231f]">Sessions</h2>
          <span className="text-[16px] text-[#565550]">×</span>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="w-[240px] shrink-0 border-r border-[#24231f]/10 bg-[#f7f7f4]/70">
            {[
              { a: "Implement", id: "#50", t: "2 min ago", on: true, dot: "#dd4f1e" },
              { a: "Refine", id: "#48", t: "1 hr ago", on: false, dot: "#7fca9c" },
              { a: "Create", id: "—", t: "3 hr ago", on: false, dot: "#7fca9c" },
            ].map((r) => (
              <div key={r.id + r.t}
                className={`flex items-center gap-2.5 border-b border-[#24231f]/10 px-3 py-2.5 ${r.on ? "bg-white shadow-[inset_2.5px_0_0_0_#dd4f1e]" : ""}`}>
                <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: r.dot }} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-1.5">
                    <span className={`text-[12.5px] font-bold ${r.on ? "text-[#24231f]" : "text-[#565550]"}`}>{r.a}</span>
                    <span className="text-[11px] text-[#565550]">{r.id}</span>
                  </span>
                  <span className="block text-[10.5px] text-[#565550]">{r.t}</span>
                </span>
              </div>
            ))}
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-2 px-4 pt-4">
              <span className="text-[14px] font-extrabold tracking-[-0.02em] text-[#24231f]">Implement</span>
              <span className="rounded-[6px] border border-[#dd4f1e] px-1.5 py-px text-[11px] font-bold text-[#b83a12]">#50</span>
              <span className="text-[11px] text-[#565550]">Aug 20, 14:02</span>
            </div>

            {/* the tab strip — the log and the changes are two views of one run */}
            <div className="mt-3 flex shrink-0 items-end gap-5 border-b border-[#24231f]/15 px-4">
              <span className="pb-2 text-[12.5px] font-bold text-[#565550]">Log</span>
              <span className="flex items-center gap-1.5 border-b-2 border-[#dd4f1e] pb-2 text-[12.5px] font-extrabold text-[#24231f]">
                Uncommitted changes
                <span className="rounded-full bg-[#f7ddce] px-1.5 text-[10.5px] font-bold text-[#b83a12]">4</span>
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden p-4">
              <p className="mb-3 text-[11px] text-[#565550]">
                <span className="font-mono">~/git/ai4kanban</span> · read just now
              </p>
              <div className="rounded-[13px] border-[1.5px] border-[#24231f] bg-white shadow-[3px_3px_0_0_#24231f]">
                <File name="kanban-ui/lib/diff.ts" plus={62} minus={0} open />
                <File name="kanban-ui/components/RunDiff.tsx" plus={104} minus={0} />
                <File name="kanban-ui/app/actions.ts" plus={11} minus={2} />
                <File name="kanban-ui/README.md" plus={7} minus={1} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
