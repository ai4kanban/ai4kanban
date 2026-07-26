import { boardRows } from "../content";
import { SectionHeading } from "../SectionHeading";
import { panelStatic } from "../styles";

export function BoardTable() {
  return (
    <section id="board" className="mt-24 scroll-mt-20">
      <SectionHeading num="02" eyebrow="Usage" title="Using AI4Kanban in Claude Code" />
      <p className="text-ink">Once installed, drive it in plain language:</p>

      <div className={`${panelStatic} mt-5 overflow-hidden bg-code`}>
        {/* terminal chrome */}
        <div className="flex items-center gap-2 border-b-2 border-border px-4 py-2.5">
          <span className="h-3 w-3 rounded-full bg-[#ff5f56]" />
          <span className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
          <span className="h-3 w-3 rounded-full bg-[#27c93f]" />
          <span className="ml-2 font-mono text-xs text-muted">you › claude</span>
        </div>

        <div className="divide-y divide-border font-mono text-sm">
          {boardRows.map((r) => (
            <div key={r.say} className="px-4 py-3.5">
              <div className="flex items-baseline gap-2">
                <span className="select-none text-accent">›</span>
                <span className="font-semibold text-ink">{r.say}</span>
              </div>
              <div className="mt-1.5 flex items-baseline gap-2 pl-4 text-muted">
                <span className="select-none text-accent/60">⤷</span>
                <span>{r.does}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
