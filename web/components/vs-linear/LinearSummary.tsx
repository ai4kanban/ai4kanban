import { Rich } from "../Rich";
import { SectionHeading } from "../SectionHeading";
import { panelInset } from "../styles";
import type { VsLinearCopy } from "@/i18n/vs-linear/types";

export function LinearSummary({ c }: { c: VsLinearCopy["summary"] }) {
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
