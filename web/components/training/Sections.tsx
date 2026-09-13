import type { ReactNode } from "react";
import { PixelMark } from "@/components/ui/PixelMark";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/SectionHeading";
import { heroTop } from "@/components/styles";
import type { TrainingCopy } from "@/i18n/training/types";

// Everything on the training page above the week: the offer, why a project
// stalls, what the work is aimed at, what a session covers, and the two prices.
//
// All of it renders on the server. The booking flow is the one client island on
// the page (`Booking.tsx`), because it is the only part that needs to know what
// zone the reader is in.

export const BOOKING_ANCHOR = "booking";

/** The page's one list shape: a bold lead-in, an em dash, the sentence. */
function Point({ lead, children }: { lead: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
      <span>
        <span className="font-semibold text-ink">{lead}</span>
        <span className="text-muted"> — {children}</span>
      </span>
    </li>
  );
}

/**
 * The opening. The side panel is the shape of the engagement rather than a
 * second pitch: four steps in order, so a reader sees what an hour buys before
 * they read a price.
 *
 * One call to action, and it scrolls to the week. The whole page has exactly one
 * way to book, so there is nothing to choose between before you know what this
 * is.
 */
function Hero({ t }: { t: TrainingCopy }) {
  return (
    <section className={`grid items-center gap-10 ${heroTop} lg:grid-cols-[1.5fr_1fr] lg:gap-16`}>
      <div>
        <p className="font-mono text-xs font-semibold tracking-widest text-accent-deep">
          {t.hero.eyebrow}
        </p>
        <h1 className="mt-5 text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl">
          {t.hero.title}
        </h1>
        <p className="mt-6 max-w-xl text-[1.05rem] leading-relaxed text-muted">{t.hero.lead}</p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button href={`#${BOOKING_ANCHOR}`} variant="primary">
            {t.hero.cta}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl bg-band px-8 py-7">
        <PixelMark />
        <p className="mt-5 text-xl font-bold">{t.hero.stepsTitle}</p>
        <ol className="mt-6 space-y-4">
          {t.hero.steps.map((step, index) => (
            <li key={step} className="flex items-center gap-4">
              <span className="font-mono text-xs text-accent-deep">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="text-[0.95rem] text-ink">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** 01 — the three ways a solo project stops short of shipping. */
function Stuck({ t }: { t: TrainingCopy }) {
  return (
    <section className="mt-10 pb-8">
      <SectionHeading num="01" eyebrow={t.stuck.heading.eyebrow} title={t.stuck.heading.title} />
      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
        {t.stuck.items.map((item, index) => (
          <div key={item.lead} className="py-3 pr-6">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-accent-deep">
              {String(index + 1).padStart(2, "0")}
            </p>
            <p className="mt-3 font-semibold text-ink">{item.lead}</p>
            <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * 02 — what the work is aimed at.
 *
 * The numbers are goals, and the line under the row says whose: this project's
 * own development is the worked example, and nothing here is offered as a
 * customer result or a promise about anybody else's.
 */
function Outcome({ t }: { t: TrainingCopy }) {
  return (
    <section className="mt-8">
      <SectionHeading
        num="02"
        eyebrow={t.outcome.heading.eyebrow}
        title={t.outcome.heading.title}
      />
      <p className="mt-3 text-base text-muted">{t.outcome.lead}</p>
      <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {t.outcome.metrics.map((metric) => (
          <div key={metric.unit} className="py-4 pr-7">
            <p className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="text-5xl font-bold tracking-tight text-ink">{metric.value}</span>
              <span className="text-sm font-semibold text-muted">{metric.unit}</span>
            </p>
            <p className="mt-3 text-[0.95rem] leading-relaxed text-muted">{metric.body}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[0.95rem] leading-relaxed text-ink">{t.outcome.note}</p>
    </section>
  );
}

/**
 * 03 — what a session covers.
 *
 * The number and the H2 sit outside the filled block, left-aligned with every
 * heading above them: the wash carries the four items and nothing else, so the
 * section reads as one more chapter rather than a card that broke the column.
 */
function Guidance({ t }: { t: TrainingCopy }) {
  const [first, second] = [t.guidance.points.slice(0, 2), t.guidance.points.slice(2)];
  return (
    <section className="mt-10">
      <SectionHeading
        num="03"
        eyebrow={t.guidance.heading.eyebrow}
        title={t.guidance.heading.title}
      />
      <div className="mt-6 grid grid-cols-1 gap-x-12 gap-y-4 rounded-2xl bg-band px-6 py-6 md:grid-cols-2">
        {[first, second].map((column, index) => (
          <ul key={index} className="space-y-4 text-[0.95rem] leading-relaxed">
            {column.map((point) => (
              <Point key={point.lead} lead={point.lead}>
                {point.body}
              </Point>
            ))}
          </ul>
        ))}
      </div>
    </section>
  );
}

/**
 * 04 — the two services, priced on the page.
 *
 * Neither carries a button. The page has one way to book and it is the week
 * below; which service you are booking is a field on the form, where it can name
 * the hour it is actually taking.
 */
function Tiers({ t }: { t: TrainingCopy }) {
  return (
    <section className="mt-12 pb-10">
      <SectionHeading num="04" eyebrow={t.tiers.heading.eyebrow} title={t.tiers.heading.title} />
      <p className="mt-2 max-w-2xl text-[0.95rem] leading-relaxed text-muted">{t.tiers.lead}</p>

      <div className="mt-8 grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-16">
        {[t.tiers.single, t.tiers.monthly].map((tier) => (
          <div key={tier.name} className="py-4">
            <p className="font-mono text-xs font-semibold tracking-widest text-accent-deep">
              {tier.eyebrow}
            </p>
            <h3 className="mt-4 text-xl font-bold">{tier.name}</h3>
            <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">{tier.body}</p>
            <p className="mt-5">
              <span className="text-4xl font-bold tracking-tight text-ink">{tier.price}</span>
              <span className="text-[0.95rem] text-muted">{tier.per}</span>
            </p>
            <ul className="mt-5 space-y-3 text-[0.95rem] leading-relaxed">
              {tier.rows.map((row) => (
                <Point key={row.lead} lead={row.lead}>
                  {row.body}
                </Point>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

export { Hero, Stuck, Outcome, Guidance, Tiers };
