import { Rich } from "../Rich";
import { SectionHeading } from "../SectionHeading";
import { panelInset } from "../styles";
import type { VsTaskMasterCopy } from "@/i18n/vs-task-master/types";

// The short version: what each tool asks you for. The note under it carries the
// dated facts — releases, commits, installs — so a reader can check the claim
// that this is a busy tool with a quiet repo rather than take our word for it.
export function TmSummary({ c }: { c: VsTaskMasterCopy["summary"] }) {
  return (
    <section className="mt-24">
      <SectionHeading num="01" {...c.heading} />
      <p className="text-ink">
        <Rich>{c.lead}</Rich>
      </p>
      <div className={`${panelInset} mt-5 p-6`}>
        <p className="text-[0.95rem] text-muted">
          <Rich>{c.panel}</Rich>
        </p>
      </div>
      <p className="mt-5 text-sm text-muted">
        <Rich>{c.note}</Rich>
      </p>
    </section>
  );
}
