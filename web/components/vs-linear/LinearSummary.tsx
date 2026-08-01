import { Rich } from "../Rich";
import { SectionHeading } from "../SectionHeading";
import { panelStatic } from "../styles";
import type { VsLinearCopy } from "@/i18n/types";

export function LinearSummary({ c }: { c: VsLinearCopy["summary"] }) {
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
