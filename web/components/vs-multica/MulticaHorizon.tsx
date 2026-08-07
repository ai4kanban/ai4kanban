import { FiArrowRight, FiFlag } from "react-icons/fi";
import { Rich } from "../Rich";
import { SectionHeading } from "../SectionHeading";
import { panelInset } from "../styles";
import type { VsMulticaCopy } from "@/i18n/vs-multica/types";

export function MulticaHorizon({
  c,
}: {
  c: VsMulticaCopy["horizon"];
}) {
  return (
    <section className="mt-24">
      <SectionHeading num="05" {...c.heading} />
      <p className="text-ink">
        <Rich>{c.lead}</Rich>
      </p>

      <div className={`${panelInset} mt-7 overflow-hidden p-5 sm:p-7`}>
        <div className="relative grid gap-5 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <div className="rounded-lg border-2 border-border bg-elev p-5">
            <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.17em] text-muted">
              {c.shippedLabel}
            </p>
            <h3 className="mt-2 font-semibold text-ink">{c.shippedTitle}</h3>
            <p className="mt-2 text-sm text-muted">
              <Rich>{c.shippedBody}</Rich>
            </p>
          </div>

          <div className="flex flex-col items-center">
            <FiArrowRight className="hidden h-5 w-5 text-muted sm:block" />
            <span className="rounded-full border-2 border-border bg-accent-deep px-3 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-wider text-elev">
              {c.marker}
            </span>
          </div>

          <div className="rounded-lg border-2 border-dashed border-border bg-code p-5">
            <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.17em] text-accent-deep">
              {c.visionLabel}
            </p>
            <h3 className="mt-2 font-semibold text-ink">{c.visionTitle}</h3>
            <p className="mt-2 text-sm text-muted">
              <Rich code="wash">{c.visionBody}</Rich>
            </p>
          </div>
        </div>
      </div>

      <p className="mt-5 flex items-start gap-2.5 text-sm text-muted">
        <FiFlag className="mt-0.5 h-4 w-4 shrink-0 text-caution" aria-hidden="true" />
        <Rich>{c.note}</Rich>
      </p>
    </section>
  );
}
