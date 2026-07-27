import { Rich } from "../Rich";
import { SectionHeading } from "../SectionHeading";
import { panelStatic } from "../styles";
import type { VsVibeCopy } from "@/i18n/types";

// The shutdown is why people are here — lead with it, honestly, then say what
// carries over to ai4kanban and what doesn't.
export function VkSummary({ c }: { c: VsVibeCopy["summary"] }) {
  return (
    <section className="mt-24">
      <SectionHeading num="01" {...c.heading} />
      <p className="text-ink">{c.lead}</p>

      <div className={`${panelStatic} mt-5 bg-code p-6`}>
        <p className="text-[0.95rem] text-muted">
          <Rich>{c.panel}</Rich>
        </p>
      </div>
    </section>
  );
}
