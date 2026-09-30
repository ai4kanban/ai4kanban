"use client";

import { useState, type ReactNode } from "react";
import { FiArrowRight, FiCheck } from "react-icons/fi";
import { Button } from "@/components/ui/Button";
import type { PricingCopy, Workflow } from "@/i18n/pricing/types";

type Billing = "yearly" | "monthly";

const CHECKOUT = "https://cloud.ai4kanban.dev/billing/checkout?period=";

const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-deep";

// Background only: task cards glide right along faint lanes, and prices roll in
// like an odometer. Reduced motion: the board stands still, the price shows as is.
const MOTION = `
@keyframes pr-roll { from { transform: translateY(0) } to { transform: translateY(var(--to)) } }
@keyframes pr-lane { from { transform: translateX(-50%) } to { transform: translateX(0) } }
@keyframes pr-strike { from { background-size: 0 2px } to { background-size: 100% 2px } }
.pr-digit { animation: pr-roll 1.1s cubic-bezier(.2,.9,.25,1) both }
.pr-lane { animation: pr-lane var(--dur) linear infinite }
.pr-strike { background: linear-gradient(var(--color-accent-deep),var(--color-accent-deep)) no-repeat 0 55% / 100% 2px;
  animation: pr-strike .5s .9s ease-out both }
.pr-board { mask-image: radial-gradient(closest-side, transparent 62%, #000 82%, transparent 100%);
  -webkit-mask-image: radial-gradient(closest-side, transparent 62%, #000 82%, transparent 100%) }
@media (prefers-reduced-motion: reduce) {
  .pr-digit, .pr-strike, .pr-lane { animation: none }
  .pr-digit { transform: translateY(var(--to)) }
}`;

const FLOW: Record<Workflow, string> = {
  coding: "bg-[#e4f3ea] text-growth",
  email: "bg-[#f7ddce] text-accent-deep",
  slides: "bg-[#efe9fb] text-[#5a3f92]",
  video: "bg-[#e6f1fb] text-[#2c5c86]",
};
const ORDER: Workflow[] = [
  "coding", "email", "coding", "slides", "video", "coding", "email", "slides", "coding", "video",
];
const LANES = [60, 84, 70, 92, 76, 66, 88, 72, 80, 64, 90, 74, 86, 68];

function Board({ board }: { board: PricingCopy["board"] }) {
  const seen: Partial<Record<Workflow, number>> = {};
  const tasks = ORDER.map((flow) => {
    const n = seen[flow] ?? 0;
    seen[flow] = n + 1;
    return { flow, title: board.tasks[flow][n % board.tasks[flow].length] };
  });

  return (
    <div
      aria-hidden="true"
      className="pr-board pointer-events-none absolute -inset-x-6 -top-8 -bottom-20 flex flex-col gap-9 overflow-hidden pt-2 opacity-80 md:-inset-x-40"
    >
      {LANES.map((dur, lane) => {
        const cards = Array.from({ length: 10 }, (_, i) => tasks[(lane * 3 + i) % tasks.length]);
        return (
          <div key={lane} className="shrink-0 py-2">
            <div
              className="pr-lane flex w-max gap-5"
              style={{ ["--dur" as string]: `${dur}s`, animationDelay: `-${lane * 5}s` }}
            >
              {[...cards, ...cards].map((c, i) => (
                <span
                  key={i}
                  className="flex shrink-0 items-center gap-2 rounded-lg bg-elev px-3 py-2 shadow-[0_2px_6px_-2px_rgba(36,35,31,0.25)]"
                >
                  <span className={`rounded px-1.5 py-0.5 text-[0.7rem] font-semibold ${FLOW[c.flow]}`}>
                    {board.tags[c.flow]}
                  </span>
                  <span className="whitespace-nowrap text-[0.8rem] text-ink/75">{c.title}</span>
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Odometer({ value }: { value: string }) {
  return (
    <span className="text-5xl font-bold leading-none tracking-tight tabular-nums">
      <span className="sr-only">{value}</span>
      <span aria-hidden="true" className="inline-flex">
        {[...value].map((ch, i) =>
          /\d/.test(ch) ? (
            <span key={i} className="inline-block h-[1em] overflow-hidden">
              <span
                className="pr-digit flex flex-col"
                style={{ ["--to" as string]: `-${10 + Number(ch)}em`, animationDelay: `${i * 90}ms` }}
              >
                {Array.from({ length: 20 }, (_, n) => (
                  <span key={n} className="h-[1em]">
                    {n % 10}
                  </span>
                ))}
              </span>
            </span>
          ) : (
            <span key={i}>{ch}</span>
          ),
        )}
      </span>
    </span>
  );
}

function Rows({ rows }: { rows: string[] }) {
  return (
    <ul className="space-y-3 text-[0.95rem] leading-relaxed text-ink">
      {rows.map((row) => (
        <li key={row} className="flex gap-3">
          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center text-accent">
            <FiCheck className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
          </span>
          <span>{row}</span>
        </li>
      ))}
    </ul>
  );
}

function BillingSwitch({
  t,
  billing,
  onChange,
}: {
  t: PricingCopy["billing"];
  billing: Billing;
  onChange: (b: Billing) => void;
}) {
  const option = (value: Billing, label: ReactNode) => (
    <button
      type="button"
      aria-pressed={billing === value}
      onClick={() => onChange(value)}
      className={`inline-flex cursor-pointer items-center gap-2 rounded-md px-4 py-1.5 text-[0.95rem] font-semibold transition-colors ${focus} ${
        billing === value ? "bg-accent/10 text-accent-deep" : "text-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border-2 border-border bg-elev p-1 shadow-[4px_4px_0_0_var(--color-ink)]">
      {option("monthly", t.monthly)}
      {option(
        "yearly",
        <>
          {t.yearly}
          <span className="rounded bg-accent/15 px-1.5 py-0.5 text-xs font-bold text-accent-deep">{t.save}</span>
        </>,
      )}
    </div>
  );
}

function Plan({
  name,
  price,
  was,
  per,
  sub,
  leadIn,
  rows,
  button,
}: {
  name: string;
  price: ReactNode;
  was?: string;
  per?: string;
  sub: string;
  leadIn?: string;
  rows: string[];
  button: ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-xl bg-elev px-6 py-8 shadow-[0_6px_18px_-6px_rgba(36,35,31,0.45)] sm:px-8">
      <h2 className="text-xl font-bold tracking-tight">{name}</h2>
      <p className="mt-4 flex flex-wrap items-baseline gap-x-2" aria-live="polite">
        {price}
        {per && <span className="text-[0.95rem] text-muted">{per}</span>}
        {was && <s className="pr-strike ml-1 text-lg text-muted no-underline">{was}</s>}
      </p>
      {/* Keeps its height when empty, so the button never moves. */}
      <p className="mt-2 min-h-6 text-[0.95rem] text-muted">{sub}</p>
      {button}
      <div className="mt-7 border-t border-ink/10 pt-6">
        {leadIn && <p className="mb-3 text-[0.95rem] font-semibold">{leadIn}</p>}
        <Rows rows={rows} />
      </div>
    </section>
  );
}

const link = `mt-4 inline-flex items-center gap-2 rounded font-semibold text-accent-deep hover:underline ${focus}`;

export function Plans({
  t,
  links,
}: {
  t: PricingCopy;
  links: { download: string; seed: string; custom: string; training: string };
}) {
  const [billing, setBilling] = useState<Billing>("yearly");
  const pro = billing === "yearly" ? t.pro.yearly : t.pro.monthly;
  const yearAtMonthly = `$${Number(t.pro.monthly.price.replace(/\D/g, "")) * 12}`;

  return (
    <>
      <style>{MOTION}</style>
      <div className="mt-8 text-center">
        <BillingSwitch t={t.billing} billing={billing} onChange={setBilling} />
      </div>

      <div className="relative mt-12">
        <Board board={t.board} />
        <div className="relative mx-auto grid max-w-4xl gap-6 md:grid-cols-2 md:gap-10">
          <Plan
            name={t.free.name}
            price={<Odometer value={t.free.price} />}
            sub={t.free.tagline}
            rows={t.free.rows}
            button={
              <Button href={links.download} className="mt-6 w-full">
                {t.free.button}
              </Button>
            }
          />
          <Plan
            key={billing}
            name={t.pro.name}
            price={<Odometer value={pro.price} />}
            was={billing === "yearly" ? yearAtMonthly : undefined}
            per={pro.per}
            sub={billing === "yearly" ? t.pro.yearly.sub : ""}
            leadIn={t.pro.leadIn}
            rows={t.pro.rows}
            button={
              <Button href={`${CHECKOUT}${billing}`} variant="primary" className="mt-6 w-full">
                {t.pro.button}
              </Button>
            }
          />
        </div>
      </div>

      <div className="mx-auto mt-16 grid max-w-4xl gap-10 md:grid-cols-3 md:gap-12">
        <section>
          <h2 className="text-xl font-bold tracking-tight">{t.seed.name}</h2>
          <p className="mt-3 max-w-xl text-[0.95rem] leading-relaxed text-muted">{t.seed.body}</p>
          <a href={links.seed} className={link}>
            {t.seed.button}
            <FiArrowRight aria-hidden="true" />
          </a>
        </section>
        <section>
          <h2 className="text-xl font-bold tracking-tight">{t.custom.name}</h2>
          <p className="mt-3 flex items-baseline gap-1">
            <span className="text-2xl font-bold tracking-tight">{t.custom.price}</span>
            <span className="text-[0.95rem] text-muted">{t.custom.per}</span>
          </p>
          <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">{t.custom.body}</p>
          <a href={links.custom} className={link}>
            {t.custom.button}
            <FiArrowRight aria-hidden="true" />
          </a>
        </section>
        <section>
          <h2 className="text-xl font-bold tracking-tight">{t.training.name}</h2>
          <a href={links.training} className={link}>
            {t.training.button}
            <FiArrowRight aria-hidden="true" />
          </a>
        </section>
      </div>
    </>
  );
}
