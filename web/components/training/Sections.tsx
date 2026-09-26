import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { column, framed, heroTop, panelInset, panelStatic } from "@/components/styles";
import type { TrainingCopy, Tier } from "@/i18n/training/types";
import { BUILDER_PATH } from "@/components/social";
import { BOOKING_ANCHOR, BookButton } from "./BookButton";

// Everything on the training page above the week, server-rendered. The booking
// flow is the page's one client island (`Booking.tsx`); the price-card buttons
// reach it through `BookButton`.

/** The apricot the monthly card head and an open hour share. */
export const apricot = "bg-[#fbe8d3]";

const BOARD_SHOT = "https://cdn.ai4kanban.dev/ai4kanban-ui-v6-board-view.jpg";
const PORTRAIT = "https://cdn.dist0.com/images/tao.avatar.jpg";

const gap = "mt-20 sm:mt-24";

export function Heading({
  eyebrow,
  title,
  dark = false,
}: {
  eyebrow: string;
  title: string;
  dark?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="h-5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
        <span
          className={`font-mono text-xs font-semibold uppercase tracking-[0.2em] ${dark ? "text-accent" : "text-accent-deep"}`}
        >
          {eyebrow}
        </span>
      </div>
      <h2 className="mt-3 text-[1.7rem] font-bold leading-tight tracking-tight sm:text-3xl">
        {title}
      </h2>
    </div>
  );
}

/** A full-bleed block with hard edges. */
export function Banded({
  dark = false,
  className = "",
  children,
}: {
  dark?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`${dark ? "bg-ink text-elev" : "bg-band"} ${className}`}>
      <div className={`${column} py-12 sm:py-16`}>{children}</div>
    </div>
  );
}

export function Hero({ t }: { t: TrainingCopy }) {
  return (
    <section
      className={`grid items-center gap-10 ${heroTop} lg:grid-cols-[1fr_1.25fr] lg:gap-14`}
    >
      <div>
        <p className="font-mono text-xs font-semibold tracking-widest text-accent-deep">
          {t.hero.eyebrow}
        </p>
        <h1 className="mt-5 text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl">
          {t.hero.title}
        </h1>
        <p className="mt-6 max-w-xl text-[1.05rem] leading-relaxed text-muted">{t.hero.lead}</p>
        <div className="mt-8">
          <Button href={`#${BOOKING_ANCHOR}`} variant="primary">
            {t.hero.cta}
          </Button>
        </div>
      </div>
      <div className={`${panelInset} p-2`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={BOARD_SHOT}
          alt={t.hero.shotAlt}
          loading="eager"
          fetchPriority="high"
          className="block w-full rounded-lg"
        />
      </div>
    </section>
  );
}

export function Stuck({ t }: { t: TrainingCopy }) {
  return (
    <section className={gap}>
      <Heading {...t.stuck.heading} />
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        {t.stuck.items.map((item) => (
          <div
            key={item.lead}
            className="rounded-xl bg-band px-6 py-6 shadow-[4px_4px_0_0_var(--color-ink)]"
          >
            <p className="text-lg font-bold leading-snug text-ink">{item.lead}</p>
            <p className="mt-3 text-[0.95rem] leading-relaxed text-muted">{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * The numbers are goals, and the note under them says whose: this project's own
 * development, never a customer result.
 */
export function Outcome({ t }: { t: TrainingCopy }) {
  return (
    <Banded dark className={gap}>
      <section>
        <Heading {...t.outcome.heading} dark />
        <p className="mt-3 text-base text-elev/70">{t.outcome.lead}</p>
        <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-0 md:divide-x-2 md:divide-elev/15">
          {t.outcome.metrics.map((metric) => (
            <div key={metric.unit} className="md:px-8 md:first:pl-0">
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-5xl font-bold tracking-tight text-accent sm:text-6xl">
                  {metric.value}
                </span>
                <span className="text-sm font-semibold text-elev/80">{metric.unit}</span>
              </p>
              <p className="mt-3 text-[0.95rem] leading-relaxed text-elev/70">{metric.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 border-t-2 border-elev/15 pt-6 text-[0.95rem] leading-relaxed">
          {t.outcome.note}
        </p>
      </section>
    </Banded>
  );
}

export function Guidance({ t }: { t: TrainingCopy }) {
  return (
    <section className={gap}>
      <Heading {...t.guidance.heading} />
      <ul className="mt-8 grid grid-cols-1 gap-x-12 gap-y-5 leading-relaxed md:grid-cols-2">
        {t.guidance.points.map((point) => (
          <li key={point.lead} className="flex gap-3">
            <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            <span>
              <span className="font-semibold text-ink">{point.lead}</span>
              <span className="text-muted"> — {point.body}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Coach({ t }: { t: TrainingCopy }) {
  return (
    <section className={`${gap} sm:grid sm:grid-cols-[174px_1fr] sm:items-center sm:gap-12`}>
      <div className={`${panelInset} h-28 w-28 overflow-hidden p-2 sm:h-[174px] sm:w-[174px]`}>
        {/* The portrait /builder uses, at its canonical URL. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={PORTRAIT}
          alt="Tao Wu"
          width={174}
          height={174}
          loading="lazy"
          className="block aspect-square h-full w-full rounded-lg object-cover"
        />
      </div>
      <div className="mt-6 sm:mt-0">
        <Heading {...t.coach.heading} />
        <p className="mt-4 max-w-2xl leading-relaxed text-muted">{t.coach.body}</p>
        <a
          href={BUILDER_PATH}
          className="mt-5 inline-block font-semibold text-ink underline decoration-accent decoration-2 underline-offset-[3px]"
        >
          {t.coach.link}
        </a>
      </div>
    </section>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-accent-deep">
      <path
        d="M20 6 9 17l-5-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TierCard({
  tier,
  service,
}: {
  tier: Tier;
  service: "single" | "monthly";
}) {
  const monthly = service === "monthly";
  return (
    <div className={`${panelStatic} ${framed} flex flex-col overflow-hidden`}>
      <div className={`px-6 py-5 sm:px-7 ${monthly ? apricot : "bg-band"}`}>
        <p className="font-mono text-[0.7rem] font-semibold tracking-widest text-accent-deep">
          {tier.eyebrow}
        </p>
        <h3 className="mt-2 text-xl font-bold tracking-tight">{tier.name}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{tier.body}</p>
        <p className="mt-4 flex items-baseline gap-1.5">
          <span className="text-[2.6rem] leading-none font-bold tracking-tight">{tier.price}</span>
          <span className="text-sm text-muted">{tier.per.trim()}</span>
        </p>
      </div>
      <ul className="flex-1 divide-y divide-ink/10 px-6 py-2 sm:px-7">
        {tier.rows.map((row) => (
          <li key={row.lead} className="flex gap-3 py-3">
            <Check />
            <div className="min-w-0">
              <p className="text-[0.95rem] font-semibold">{row.lead}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-muted">{row.body}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="px-6 pb-6 sm:px-7">
        <BookButton service={service} variant={monthly ? "primary" : "secondary"}>
          {tier.cta}
        </BookButton>
      </div>
    </div>
  );
}

export function Tiers({ t }: { t: TrainingCopy }) {
  return (
    <section className={gap}>
      <Heading {...t.tiers.heading} />
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{t.tiers.lead}</p>
      <div className="mt-7 grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
        <TierCard tier={t.tiers.single} service="single" />
        <TierCard tier={t.tiers.monthly} service="monthly" />
      </div>
    </section>
  );
}
