import type { ReactNode } from "react";
import { GITHUB_URL } from "../content";
import { Rich } from "../Rich";
import { SectionHeading } from "../SectionHeading";
import { Button } from "../ui/Button";
import { panelInset, panelStatic } from "../styles";
import type { SharedCopy } from "@/i18n/shared/types";
import type { VsDecision } from "@/i18n/types";
import { localeHref, type Locale } from "@/lib/i18n";

// The closing "which should you use?" section, shared by all comparison
// pages: two guide columns, then the bottom line and the two CTAs.

// Ours is on the paper, theirs in the wash — the neutral ramp is what says which
// column is the answer. It used to ask for a tinted fill and an accent border on
// top of `panelStatic`, and got neither: both lost to the fill and border already
// in that string, so the two columns rendered identical. See design.md §3.
function Guide({
  tag,
  heading,
  items,
  highlight,
}: {
  tag: ReactNode;
  heading: string;
  items: string[];
  highlight?: boolean;
}) {
  return (
    <div className={`${highlight ? panelStatic : panelInset} p-6`}>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="text-xl" aria-hidden="true">
          {tag}
        </span>
        <h3 className="font-semibold text-ink">{heading}</h3>
      </div>
      <ul className="space-y-2.5">
        {items.map((it) => (
          <li key={it} className="flex items-baseline gap-2.5 text-[0.95rem] text-muted">
            <span className="select-none text-accent-deep" aria-hidden="true">
              →
            </span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DecisionSection({
  num,
  c,
  shared,
  locale,
  theirsTag,
}: {
  num: string;
  c: VsDecision;
  shared: SharedCopy;
  locale: Locale;
  theirsTag: ReactNode;
}) {
  return (
    <section className="mt-24">
      <SectionHeading num={num} {...c.heading} />

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Guide tag="🗂️" heading={c.oursHeading} items={c.ours} highlight />
        <Guide tag={theirsTag} heading={c.theirsHeading} items={c.theirs} />
      </div>

      {/* Bottom line */}
      <div className={`${panelInset} mt-8 p-6 sm:p-8`}>
        <div className="flex items-center gap-3">
          <span className="h-5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-accent-deep">
            {shared.bottomLine}
          </span>
        </div>
        <p className="mt-4 text-lg leading-relaxed text-ink">
          <Rich>{c.verdict}</Rich>
        </p>
        <p className="mt-4 text-[0.95rem] text-muted">{c.note}</p>
        {/* The same two buttons the landing page ends on — the component, not a
            copy of its class list, so the pair can never drift from it again. */}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button href={localeHref(locale, "/#install")} variant="primary" size="sm">
            {shared.cta.install}
          </Button>
          <Button href={GITHUB_URL} size="sm">
            {shared.cta.github}
          </Button>
        </div>
      </div>
    </section>
  );
}
