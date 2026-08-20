// Layout B — the diff as a section on the card page, under the run log.

const SOFT = "#565550";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke={SOFT} strokeWidth="2" strokeLinecap="round"
      style={{ transform: open ? "rotate(90deg)" : "none" }}>
      <path d="M6 3l5 5-5 5" />
    </svg>
  );
}

function File({ name, plus, minus, open }: { name: string; plus: number; minus: number; open?: boolean }) {
  return (
    <div className="border-b border-[#24231f]/10 last:border-b-0">
      <div className="flex items-center gap-2 px-3.5 py-2">
        <Chevron open={!!open} />
        <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-[#24231f]">{name}</span>
        <span className="flex shrink-0 items-center gap-2 font-mono text-[11px]">
          <span className="text-[#2f6b46]">+{plus}</span>
          <span className="text-[#8a4a28]">−{minus}</span>
        </span>
      </div>
      {open && (
        <div className="border-t border-[#24231f]/10 bg-[#f4f3ef] px-3.5 py-2 font-mono text-[11px] leading-[17px]">
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

export default function B() {
  return (
    <div className="h-[800px] w-[1280px] overflow-hidden bg-[#f7f7f4] font-sans">
      <div className="flex h-[52px] items-center gap-3 border-b-[1.5px] border-[#24231f] bg-white px-6">
        <span className="text-[14px] font-extrabold tracking-[-0.02em] text-[#24231f]">AI4Kanban</span>
        <span className="ml-auto text-[12px] text-[#565550]">Sessions · Configuration</span>
      </div>

      <div className="mx-auto w-full max-w-[840px] px-6 py-6">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="text-[20px] font-extrabold text-[#b83a12]">#50</span>
          <h1 className="text-[20px] font-extrabold leading-tight tracking-[-0.02em] text-[#24231f]">
            Show what a run changed in the working tree
          </h1>
        </div>

        <div className="mb-4 flex items-center gap-2">
          {["Implement", "Refine", "Archive"].map((b, i) => (
            <span key={b}
              className={`rounded-[10px] border-[1.5px] border-[#24231f] px-3 py-1.5 text-[12.5px] font-bold ${
                i === 0 ? "bg-[#dd4f1e] text-white shadow-[2px_2px_0_0_#24231f]" : "bg-white text-[#24231f]"
              }`}>
              {b}
            </span>
          ))}
        </div>

        {/* the run log, collapsed to its last line */}
        <div className="mb-4 flex items-center gap-2 rounded-[13px] border-[1.5px] border-[#24231f] bg-white px-3.5 py-2.5 shadow-[3px_3px_0_0_#24231f]">
          <Chevron open={false} />
          <span className="text-[12.5px] font-bold text-[#24231f]">Run log</span>
          <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-[#565550]">
            … wrote kanban-ui/components/RunDiff.tsx — done in 4m 12s
          </span>
        </div>

        {/* the changes, a section of the page in its own right */}
        <div className="mb-4">
          <div className="mb-1.5 flex items-baseline gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#24231f]">
              Uncommitted changes
            </span>
            <span className="rounded-full bg-[#f7ddce] px-1.5 text-[10.5px] font-bold text-[#b83a12]">4 files</span>
          </div>
          <p className="mb-2 text-[11px] text-[#565550]">
            <span className="font-mono">~/git/ai4kanban</span> · read just now
          </p>
          <div className="rounded-[13px] border-[1.5px] border-[#24231f] bg-white shadow-[3px_3px_0_0_#24231f]">
            <File name="kanban-ui/lib/diff.ts" plus={62} minus={0} open />
            <File name="kanban-ui/components/RunDiff.tsx" plus={104} minus={0} />
            <File name="kanban-ui/app/actions.ts" plus={11} minus={2} />
            <File name="kanban-ui/README.md" plus={7} minus={1} />
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-x-7 rounded-[14px] border-[1.5px] border-[#24231f] bg-white px-4 py-3">
          {[["Track", "features"], ["Modules", "local-ui"], ["Priority", "med"], ["ROI", "high"]].map(([k, v]) => (
            <span key={k} className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#565550]">{k}</span>
              <span className="text-[12.5px] font-bold text-[#24231f]">{v}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
