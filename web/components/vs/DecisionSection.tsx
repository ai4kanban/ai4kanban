import { LogoMark } from "@/components/ui/Logo";
import type { ReactNode } from "react";
import { FiArrowRight } from "react-icons/fi";
import { GITHUB_URL } from "../content";
import { Rich } from "../Rich";
import { SectionHeading } from "../SectionHeading";
import { Button } from "../ui/Button";
import { framed as frame, hairline, panelInset, panelStatic } from "../styles";
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
  surface,
}: {
  tag: ReactNode;
  heading: string;
  items: string[];
  surface: string;
}) {
  return (
    <div className={`${surface} p-6`}>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="text-xl" aria-hidden="true">
          {tag}
        </span>
        <h3 className="font-semibold text-ink">{heading}</h3>
      </div>
      <ul className="space-y-2.5">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2.5 text-[0.95rem] text-muted">
            <FiArrowRight
              className="mt-[0.3rem] h-3.5 w-3.5 shrink-0 text-accent"
              aria-hidden="true"
            />
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
  framed,
}: {
  num: string;
  c: VsDecision;
  shared: SharedCopy;
  locale: Locale;
  theirsTag: ReactNode;
  // Ours and the bottom line outlined in ink, theirs in a hairline on paper.
  framed?: boolean;
}) {
  const ours = framed ? `${panelStatic} ${frame}` : panelStatic;
  const theirs = framed ? `rounded-xl border bg-elev ${hairline}` : panelInset;
  return (
    <section className="mt-24">
      <SectionHeading num={num} {...c.heading} />

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Guide
          tag={<LogoMark size={framed ? "tag" : "xs"} />}
          heading={c.oursHeading}
          items={c.ours}
          surface={ours}
        />
        <Guide tag={theirsTag} heading={c.theirsHeading} items={c.theirs} surface={theirs} />
      </div>

      {/* Bottom line */}
      <div className={`${framed ? ours : panelInset} mt-8 p-6 sm:p-8`}>
        <div className="flex items-center gap-3">
          <span className="h-5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-accent-deep">
            {shared.bottomLine}
          </span>
        </div>
        <p className="mt-4 text-lg leading-relaxed text-ink">
          <Rich>{c.verdict}</Rich>
        </p>
        {c.note && <p className="mt-4 text-[0.95rem] text-muted">{c.note}</p>}
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
