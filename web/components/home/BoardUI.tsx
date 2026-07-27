import { uiActionIcons, uiActionOrder } from "../content";
import { BoardShots } from "./BoardShots";
import { CodeBlock } from "../CodeBlock";
import { SectionHeading } from "../SectionHeading";
import { panelStatic } from "../styles";
import type { SiteCopy } from "@/i18n/types";

// The optional local board. The Markdown files stay the source of truth; this is
// a window onto them that also turns each card's routine moves into an agent run,
// so you stop re-typing the same prompts into the chat.
export function BoardUI({ c }: { c: SiteCopy }) {
  const t = c.home.ui;
  return (
    <section id="ui" className="mt-24 scroll-mt-20">
      <SectionHeading num="03" {...t.heading} />
      <p className="text-ink">{t.lead}</p>

      {/* Two views of the same board, stacked as a flip deck (click to swap). */}
      <div className="mt-8">
        <BoardShots c={t} />
      </div>

      {/* Install: it's optional and prompt-driven, like everything else here. */}
      <p className="mt-8 text-ink">{t.optional}</p>
      <CodeBlock labels={c.shared.code}>{`/kanban run the local board UI`}</CodeBlock>
      <p className="text-muted">{t.started}</p>

      {/* Card actions — kept compact; they're self-evident once you see the board. */}
      <div className={`${panelStatic} mt-6 bg-code px-5 py-4`}>
        <p className="text-sm text-muted">{t.actionsLead}</p>
        <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2.5 text-[0.95rem] sm:grid-cols-2">
          {uiActionOrder.map((key) => (
            <li key={key} className="flex gap-2">
              <span aria-hidden="true">{uiActionIcons[key]}</span>
              <span>
                <span className="font-semibold text-ink">
                  {t.actions[key].label}
                </span>{" "}
                <span className="text-muted">— {t.actions[key].body}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
