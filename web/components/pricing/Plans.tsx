"use client";

import { useState, type ReactNode } from "react";
import { FiArrowRight, FiCheck } from "react-icons/fi";
import { Button } from "@/components/ui/Button";
import type { PricingCopy } from "@/i18n/pricing/types";

type Billing = "yearly" | "monthly";

const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-deep";

function Rows({ rows }: { rows: string[] }) {
  return (
    <ul className="space-y-2.5 text-[0.95rem] leading-relaxed text-ink">
      {rows.map((row) => (
        <li key={row} className="flex gap-3">
          <FiCheck className="mt-1 h-4 w-4 shrink-0 text-accent-deep" aria-hidden="true" />
          <span>{row}</span>
        </li>
      ))}
    </ul>
  );
}

function Price({ price, per }: { price: string; per?: string }) {
  return (
    <p className="flex items-baseline gap-1.5">
      <span className="text-5xl font-bold tracking-tight text-ink">{price}</span>
      {per && <span className="text-[0.95rem] text-muted">{per}</span>}
    </p>
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
        billing === value ? "bg-accent-deep text-elev" : "text-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="inline-flex items-center rounded-lg bg-code p-1">
      {option("monthly", t.monthly)}
      {option(
        "yearly",
        <>
          {t.yearly}
          <span className="text-xs font-medium">{t.save}</span>
        </>,
      )}
    </div>
  );
}

const plan = "flex flex-col rounded-xl bg-band px-6 py-8 sm:px-8";
const link = `mt-4 inline-flex items-center gap-2 rounded font-semibold text-accent-deep hover:underline ${focus}`;

export function Plans({
  t,
  links,
}: {
  t: PricingCopy;
  links: { download: string; contact: string; training: string };
}) {
  const [billing, setBilling] = useState<Billing>("yearly");
  const pro = billing === "yearly" ? t.pro.yearly : t.pro.monthly;

  return (
    <>
      <div className="mt-7 text-center">
        <BillingSwitch t={t.billing} billing={billing} onChange={setBilling} />
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2 md:gap-16">
        <section className={plan}>
          <h2 className="text-2xl font-bold tracking-tight">{t.free.name}</h2>
          <div className="mt-5">
            <Price price={t.free.price} />
            <p className="mt-3 min-h-6 text-[0.95rem] text-muted">{t.free.tagline}</p>
          </div>
          <Button href={links.download} variant="primary" className="mt-6">
            {t.free.button}
          </Button>
          <div className="mt-8">
            <Rows rows={t.free.rows} />
          </div>
        </section>

        <section className={plan}>
          <h2 className="text-2xl font-bold tracking-tight">{t.pro.name}</h2>
          {/* The sub-line keeps its height when empty, so the button never moves. */}
          <div className="mt-5" aria-live="polite">
            <Price price={pro.price} per={pro.per} />
            <p className="mt-3 min-h-6 text-[0.95rem] text-muted">
              {billing === "yearly" ? t.pro.yearly.sub : ""}
            </p>
          </div>
          <button
            type="button"
            disabled
            className="mt-6 cursor-not-allowed rounded-lg border-2 border-transparent bg-code px-6 py-3 font-semibold text-muted"
          >
            {t.pro.button}
          </button>
          <p className="mt-8 text-[0.95rem] font-semibold">{t.pro.leadIn}</p>
          <div className="mt-3">
            <Rows rows={t.pro.rows} />
          </div>
        </section>
      </div>

      <div className="mt-12 grid gap-8 border-t border-ink/10 pt-8 md:grid-cols-[2fr_1fr] md:gap-20">
        <section>
          <h2 className="text-xl font-bold tracking-tight">{t.seed.name}</h2>
          <p className="mt-3 max-w-xl text-[0.95rem] leading-relaxed text-muted">{t.seed.body}</p>
          <a href={links.contact} className={link}>
            {t.seed.button}
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
