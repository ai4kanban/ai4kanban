import { Rich } from "../Rich";
import { SectionHeading } from "../SectionHeading";
import { panelInset } from "../styles";
import type { VsVibeCopy } from "@/i18n/vs-vibe-kanban/types";

// Bloop's closure is why people are here. Explain what changed, then distinguish
// AI4Kanban's planning workflow from Vibe Kanban's orchestration features.
export function VkSummary({ c }: { c: VsVibeCopy["summary"] }) {
  return (
    <section className="mt-24">
      <SectionHeading num="01" {...c.heading} />
      <p className="text-ink">{c.lead}</p>

      <div className={`${panelInset} mt-5 p-6`}>
        <p className="text-[0.95rem] text-muted">
          <Rich>{c.panel}</Rich>
        </p>
      </div>
    </section>
  );
}
