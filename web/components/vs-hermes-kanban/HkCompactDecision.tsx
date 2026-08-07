import { GITHUB_URL } from "../content";
import { Rich } from "../Rich";
import { SectionHeading } from "../SectionHeading";
import { Button } from "../ui/Button";
import { panelInset } from "../styles";
import type { SharedCopy } from "@/i18n/shared/types";
import type { VsDecision } from "@/i18n/types";
import { localeHref, type Locale } from "@/lib/i18n";

// The Chinese page has already made the decision criteria visible in the
// comparison table. Its closing section therefore states the conclusion once
// instead of repeating the same criteria as two more lists.
export function HkCompactDecision({
  num,
  c,
  shared,
  locale,
}: {
  num: string;
  c: VsDecision;
  shared: SharedCopy;
  locale: Locale;
}) {
  return (
    <section className="mt-24">
      <SectionHeading num={num} {...c.heading} />

      <div className={`${panelInset} mt-6 p-6 sm:p-8`}>
        <p className="text-lg leading-relaxed text-ink">
          <Rich>{c.verdict}</Rich>
        </p>
        <p className="mt-4 text-[0.95rem] text-muted">{c.note}</p>
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
