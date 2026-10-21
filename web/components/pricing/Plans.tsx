"use client";

import { useState, type ReactNode } from "react";
import { FiArrowRight, FiCheck, FiChevronDown } from "react-icons/fi";
import { Button } from "@/components/ui/Button";
import type { PlanRow, PricingCopy } from "@/i18n/pricing/types";

type Billing = "yearly" | "monthly";
type Workflow = "coding" | "email" | "slides" | "video";

const CHECKOUT = "https://cloud.ai4kanban.dev/billing/checkout?period=";

const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-deep";

// Background only: blank task cards glide right along faint lanes, and prices roll in
// like an odometer. Reduced motion: the board stands still, the price shows as is.
const MOTION = `
@keyframes pr-roll { from { transform: translateY(0) } to { transform: translateY(var(--to)) } }
@keyframes pr-lane { from { transform: translateX(-50%) } to { transform: translateX(0) } }
@keyframes pr-strike { from { background-size: 0 2px } to { background-size: 100% 2px } }
.pr-digit { animation: pr-roll 1.1s cubic-bezier(.2,.9,.25,1) both }
.pr-lane { animation: pr-lane var(--dur) linear infinite }
.pr-strike { background: linear-gradient(var(--color-accent-deep),var(--color-accent-deep)) no-repeat 0 55% / 100% 2px;
  animation: pr-strike .5s .9s ease-out both }
.pr-board { mask-image: radial-gradient(closest-side, transparent 70%, #000 88%, transparent 100%);
  -webkit-mask-image: radial-gradient(closest-side, transparent 70%, #000 88%, transparent 100%) }
@media (prefers-reduced-motion: reduce) {
  .pr-digit, .pr-strike, .pr-lane { animation: none }
  .pr-digit { transform: translateY(var(--to)) }
}`;

// Category colour is the only information a backdrop card carries.
const FLOW: Record<Workflow, string> = {
  coding: "bg-[#cfe9d9]",
  email: "bg-[#f3cdb8]",
  slides: "bg-[#ddd3f5]",
  video: "bg-[#cfe2f5]",
};
const ORDER: Workflow[] = ["coding", "email", "slides", "coding", "video", "email"];
const WIDTHS = [64, 44, 80, 52, 72, 40];
const LANES = [70, 88, 76, 94, 82, 72, 90];

function Board() {
  return (
    <div
      aria-hidden="true"
      className="pr-board pointer-events-none absolute -inset-x-6 -top-8 -bottom-20 flex flex-col gap-14 overflow-hidden pt-4 opacity-70 md:-inset-x-40"
    >
      {LANES.map((dur, lane) => {
        const cards = Array.from({ length: 6 }, (_, i) => (lane * 2 + i) % ORDER.length);
        return (
          <div key={lane} className="shrink-0">
            <div
              className="pr-lane flex w-max gap-10"
              style={{ ["--dur" as string]: `${dur}s`, animationDelay: `-${lane * 7}s` }}
            >
              {[...cards, ...cards].map((n, i) => (
                <span
                  key={i}
                  className="flex shrink-0 items-center gap-2.5 rounded-lg bg-elev px-3 py-2.5 shadow-[0_2px_6px_-2px_rgba(36,35,31,0.2)]"
                >
                  <span className={`h-3 w-7 rounded ${FLOW[ORDER[n]]}`} />
                  <span className="flex flex-col gap-1.5">
                    <span className="h-1.5 rounded-full bg-ink/10" style={{ width: WIDTHS[n] }} />
                    {n % 2 === 0 && (
                      <span className="h-1.5 rounded-full bg-ink/[0.06]" style={{ width: WIDTHS[n] * 0.6 }} />
                    )}
                  </span>
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

function Fold({ row }: { row: Exclude<PlanRow, string> }) {
  const [open, setOpen] = useState(false);
  const { note, list, table } = row.more;
  return (
    <div className="min-w-0 flex-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
        className={`inline-flex cursor-pointer flex-wrap items-center gap-x-2 rounded text-left ${focus}`}
      >
        <span>{row.text}</span>
        <span className="inline-flex items-center gap-1 text-sm text-muted">
          {row.cue}
          <FiChevronDown className={`h-3.5 w-3.5 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </span>
      </button>
      {open && (
        <div className="mt-2 rounded-lg bg-ink/[0.04] px-3.5 py-2.5 text-sm leading-relaxed text-muted">
          {note && <p className="mb-1.5">{note}</p>}
          {list && (
            <ul className="grid grid-cols-2 gap-x-4">
              {list.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {table?.map(([name, cost]) => (
            <p key={name} className="flex justify-between gap-4">
              <span>{name}</span>
              <span className="tabular-nums text-ink">{cost}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function Rows({ rows }: { rows: PlanRow[] }) {
  return (
    <ul className="space-y-3 text-[0.95rem] leading-relaxed text-ink">
      {rows.map((row) => (
        <li key={typeof row === "string" ? row : row.text} className="flex gap-3">
          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center text-accent">
            <FiCheck className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
          </span>
          {typeof row === "string" ? <span>{row}</span> : <Fold row={row} />}
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
  rows: PlanRow[];
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
        <Board />
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
