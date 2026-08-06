import { Rich } from "../Rich";
import { SectionHeading } from "../SectionHeading";
import { panelInset } from "../styles";
import type { VsGithubCopy } from "@/i18n/vs-github-issues/types";

// The honest TL;DR up front: GitHub Issues can do it too — the difference is cost.
export function VsSummary({ c }: { c: VsGithubCopy["summary"] }) {
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
    </section>
  );
}
