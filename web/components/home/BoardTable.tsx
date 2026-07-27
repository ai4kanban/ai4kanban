import { boardRowOrder } from "../content";
import { SectionHeading } from "../SectionHeading";
import { panelStatic } from "../styles";
import type { HomeCopy } from "@/i18n/types";

export function BoardTable({ c }: { c: HomeCopy }) {
  const t = c.board;
  return (
    <section id="board" className="mt-24 scroll-mt-20">
      <SectionHeading num="02" {...t.heading} />
      <p className="text-ink">{t.lead}</p>

      <div className={`${panelStatic} mt-5 overflow-hidden bg-code`}>
        {/* terminal chrome */}
        <div className="flex items-center gap-2 border-b-2 border-border px-4 py-2.5">
          <span className="h-3 w-3 rounded-full bg-[#ff5f56]" />
          <span className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
          <span className="h-3 w-3 rounded-full bg-[#27c93f]" />
          <span className="ml-2 font-mono text-xs text-muted">{t.terminal}</span>
        </div>

        <div className="divide-y divide-border font-mono text-sm">
          {boardRowOrder.map((key) => (
            <div key={key} className="px-4 py-3.5">
              <div className="flex items-baseline gap-2">
                <span className="select-none text-accent">›</span>
                <span className="font-semibold text-ink">{t.rows[key].say}</span>
              </div>
              <div className="mt-1.5 flex items-baseline gap-2 pl-4 text-muted">
                <span className="select-none text-accent/60">⤷</span>
                <span>{t.rows[key].does}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
