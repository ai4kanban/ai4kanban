"use client";

// Configuration → Billing (#1109): the plan and its invoices, and the plans page behind them.
// Buying uses this machine's Cloud sign-in, so the browser only ever shows Creem's own pages.
// The plan cards are web/components/pricing/Plans.tsx on the app's tokens.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { FiAlertCircle, FiArrowLeft, FiCheck, FiExternalLink } from "react-icons/fi";
import {
  openBillingPortalAction,
  readBillingAction,
  readInvoicesAction,
  startCheckoutAction,
} from "@/app/actions";
import type { BillingCopy } from "@/i18n/configuration/types";
import { useCopy } from "@/i18n/use-copy";
import type { BillingRead, CloudBilling, CloudCredits, InvoicesRead } from "@/lib/types";
import { Button } from "./button";
import { openLink } from "./desktop";
import { useLanguage } from "./language";
import { CAPTION, Group, Loading, Panel } from "./settings";

type Period = "monthly" | "yearly";
export type BillingPage = "billing" | "plans";

/** After a checkout opens, how often and how long to look for the webhook's subscription. */
const POLL_MS = 5_000;
const POLL_FOR_MS = 10 * 60_000;

const BADGE = "rounded-[6px] px-1.5 py-[3px] text-[11px] font-[700] leading-none";
const TONE = {
  mint: "bg-nb-mint-soft text-nb-mint-ink",
  quiet: "bg-nb-ink/7 text-nb-ink-soft",
  peach: "bg-nb-peach-soft text-nb-peach-ink",
};
// A button slot with nothing to press: the current plan, or a plan that could not be read.
const SLOT_BOX =
  "flex h-[41px] w-full items-center justify-center gap-2 rounded-[11px] bg-nb-wash text-[13px] font-[700] text-nb-ink-soft";
const FLAT_PRIMARY =
  "inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[8px] bg-nb-accent px-3 py-1.5 text-[12.5px] font-[700] text-white disabled:cursor-default disabled:opacity-60";
const NOTE = "absolute inset-x-0 top-full mt-2 truncate text-center text-[12px] text-nb-ink-soft";
const FAIL = "text-[12.5px] font-[700] text-nb-peach-ink";

const onPro = (b: CloudBilling) => b.plan === "pro";

export function BillingPanel({
  openOn,
  onOpened,
  onSignedOut,
}: {
  openOn?: string;
  onOpened?: () => void;
  /** Cloud refused the sign-in: the account is re-read, and its sign-in entry replaces this. */
  onSignedOut?: () => void;
}) {
  const t = useCopy().configuration.billing;
  const [page, setPage] = useState<BillingPage>("billing");
  const [billing, setBilling] = useState<BillingRead | null>(null);
  const [invoices, setInvoices] = useState<InvoicesRead | null>(null);
  const [pollUntil, setPollUntil] = useState(0);
  const asked = useRef(0);

  useEffect(() => {
    if (openOn !== "plans") return;
    setPage("plans");
    onOpened?.();
  }, [openOn, onOpened]);

  const read = useCallback(async () => {
    const mine = ++asked.current;
    const [b, i] = await Promise.all([
      readBillingAction().catch((): BillingRead => ({ state: "unavailable" })),
      readInvoicesAction().catch((): InvoicesRead => ({ ok: false })),
    ]);
    if (mine !== asked.current) return;
    setBilling(b);
    setInvoices(i);
  }, []);

  // Read on every page, and again whenever the window comes back from the browser.
  useEffect(() => {
    void read();
  }, [read, page]);
  useEffect(() => {
    const onShow = () => document.visibilityState === "visible" && void read();
    const onFocus = () => void read();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onShow);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [read]);

  // Once per refusal: the callback is a fresh function on every render of the pane above.
  const signedOut = billing?.state === "signed-out";
  const toldSignedOut = useRef(onSignedOut);
  toldSignedOut.current = onSignedOut;
  useEffect(() => {
    if (signedOut) toldSignedOut.current?.();
  }, [signedOut]);

  // Once the account is Pro the purchase has landed: back to the plan and its new invoice.
  const pro = billing?.state === "ok" && onPro(billing.billing);
  useEffect(() => {
    if (!pro || !pollUntil) return;
    setPollUntil(0);
    setPage("billing");
  }, [pro, pollUntil]);

  useEffect(() => {
    if (!pollUntil) return;
    const id = setInterval(() => {
      if (Date.now() > pollUntil) setPollUntil(0);
      else void read();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [pollUntil, read]);

  if (!billing) return <Loading>{t.plan.loading}</Loading>;

  return page === "plans" ? (
    <Plans
      t={t}
      billing={billing}
      onBack={() => setPage("billing")}
      onOpened={() => setPollUntil(Date.now() + POLL_FOR_MS)}
    />
  ) : (
    <div className="flex flex-col gap-6">
      <Group title={t.plan.title}>
        <Summary t={t} billing={billing} onUpgrade={() => setPage("plans")} />
      </Group>
      {billing.state === "ok" && billing.credits && <Credits t={t.credits} credits={billing.credits} />}
      <Invoices t={t} invoices={invoices} />
    </div>
  );
}

// --- the billing page ---------------------------------------------------------

/** Open Creem's billing portal, saying so when it cannot. */
function usePortal() {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const open = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const res = await openBillingPortalAction();
      if (res.ok) openLink(res.url);
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return { busy, failed, open };
}

/** `UTC` for a date Cloud fixes in UTC, so it never reads as the day before west of it. */
function useDay(timeZone?: "UTC") {
  const language = useLanguage();
  return (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
          year: "numeric",
          month: language === "zh" ? "long" : "short",
          day: "numeric",
          timeZone,
        }).format(new Date(iso))
      : "";
}

function Summary({ t, billing, onUpgrade }: { t: BillingCopy; billing: BillingRead; onUpgrade: () => void }) {
  const p = t.plan;
  const day = useDay();
  const portal = usePortal();

  if (billing.state !== "ok")
    return (
      <div className="rounded-[12px] border border-nb-ink/12 bg-nb-paper px-5 py-4">
        <p className="flex items-center gap-2 text-[13.5px] font-[700] text-nb-ink-soft">
          <FiAlertCircle size={14} aria-hidden />
          {p.unavailable}
        </p>
      </div>
    );

  const b = billing.billing;
  const pro = onPro(b);
  const price = pro
    ? b.period === "monthly"
      ? `${t.pricing.pro.monthly.price} ${t.pricing.pro.monthly.per}`
      : `${t.pricing.pro.yearly.price} ${t.pricing.pro.yearly.per}`
    : t.pricing.free.price;
  const badge =
    b.state === "active"
      ? [p.active, TONE.mint]
      : b.state === "canceled"
        ? [p.cancelled, TONE.quiet]
        : b.state === "pastDue"
          ? [p.pastDue, TONE.peach]
          : null;
  const line =
    b.state === "active" && b.periodEnd
      ? p.renews(day(b.periodEnd))
      : b.state === "canceled" && b.periodEnd
        ? p.ends(day(b.periodEnd))
        : b.state === "expired" && b.periodEnd
          ? p.ended(day(b.periodEnd))
          : null;
  const ext = <FiExternalLink aria-hidden className="text-[12px]" />;

  const actions =
    b.state === "active" || b.state === "canceled" ? (
      <Button size="sm" variant="ghost" disabled={portal.busy} onClick={() => void portal.open()}>
        {p.manage}
        {ext}
      </Button>
    ) : b.state === "pastDue" ? (
      <div className="flex min-w-0 items-center gap-3 rounded-[10px] bg-nb-peach-soft py-2 pl-3.5 pr-2" role="status">
        <p className="flex min-w-0 items-start gap-2 text-[12.5px] leading-snug text-nb-ink">
          <FiAlertCircle className="mt-[2px] shrink-0 text-nb-peach-ink" size={14} aria-hidden />
          <span>
            <span className="font-[800] text-nb-peach-ink">{p.paymentFailed}</span> · {p.updatePaymentBody}
          </span>
        </p>
        <button type="button" className={FLAT_PRIMARY} disabled={portal.busy} onClick={() => void portal.open()}>
          {p.updatePayment}
          {ext}
        </button>
      </div>
    ) : (
      <Button size="sm" onClick={onUpgrade}>
        {p.upgrade}
      </Button>
    );

  return (
    <div className="rounded-[12px] border border-nb-ink/12 bg-nb-paper px-5 py-4">
      <div className="flex items-center justify-between gap-5">
        <div className="min-w-0">
          <p className="flex items-center gap-2">
            <span className="text-[17px] font-[800] tracking-[-0.01em] text-nb-ink">
              {pro ? t.pricing.pro.name : t.pricing.free.name}
            </span>
            {badge && <span className={`${BADGE} ${badge[1]}`}>{badge[0]}</span>}
          </p>
          <p className="mt-1 text-[13px] text-nb-ink-soft">
            <span className="font-[700] tabular-nums text-nb-ink">{price}</span>
            {line && <span> · {line}</span>}
          </p>
        </div>
        <div className={`flex items-center gap-2.5 ${b.state === "pastDue" ? "min-w-0" : "shrink-0"}`}>{actions}</div>
      </div>
      {portal.failed && (
        <p className={`${FAIL} mt-2 text-right`} role="alert">
          {p.portalFailed}
        </p>
      )}
    </div>
  );
}

function Credits({ t, credits }: { t: BillingCopy["credits"]; credits: CloudCredits }) {
  const day = useDay("UTC");
  const num = (n: number) => new Intl.NumberFormat("en-US").format(n);
  const out = credits.left === 0;
  return (
    <Group title={t.title}>
      <div className="rounded-[12px] border border-nb-ink/12 bg-nb-paper px-5 py-4">
        <div className="flex items-baseline justify-between gap-5">
          <p className="flex min-w-0 items-baseline gap-1.5">
            <span
              className={`text-[17px] font-[800] tabular-nums tracking-[-0.01em] ${out ? "text-nb-peach-ink" : "text-nb-ink"}`}
            >
              {num(credits.left)}
            </span>
            <span className="text-[13px] tabular-nums text-nb-ink-soft">{t.left(num(credits.total))}</span>
          </p>
          <p className="shrink-0 text-[13px] text-nb-ink-soft">{t.resets(day(credits.resetsAt))}</p>
        </div>
        <div className="mt-3 h-[6px] overflow-hidden rounded-full bg-nb-ink/8">
          <div
            className="h-full rounded-full bg-nb-mint"
            style={{ width: `${Math.min(100, (credits.left / credits.total) * 100)}%` }}
          />
        </div>
        {out ? (
          <p
            className="mt-3 flex items-center gap-2 rounded-[10px] bg-nb-peach-soft px-3.5 py-2.5 text-[12.5px] text-nb-ink"
            role="status"
          >
            <FiAlertCircle className="shrink-0 text-nb-peach-ink" size={14} aria-hidden />
            {t.usedUp}
          </p>
        ) : (
          <p className="mt-2 text-[12px] text-nb-ink-soft">{t.rate}</p>
        )}
      </div>
    </Group>
  );
}

function Invoices({ t: all, invoices }: { t: BillingCopy; invoices: InvoicesRead | null }) {
  const t = all.invoices;
  const day = useDay();
  const portal = usePortal();
  const tone = { paid: TONE.mint, refunded: TONE.quiet, failed: TONE.peach };
  const label = { paid: t.paid, refunded: t.refunded, failed: t.failedPayment };
  const COLS = "grid grid-cols-[150px_110px_1fr_auto] items-center gap-4";
  const money = (amount: number, currency: string) => {
    try {
      // One locale for both languages, so dollars read "$15.00" rather than "US$15.00".
      return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
        amount / 100,
      );
    } catch {
      return `${(amount / 100).toFixed(2)} ${currency}`;
    }
  };

  return (
    <Group title={t.title}>
      {!invoices ? null : !invoices.ok ? (
        <p className="flex items-center gap-2 rounded-[10px] bg-nb-peach-soft px-3.5 py-3 text-[12px] text-nb-ink" role="status">
          <FiAlertCircle className="shrink-0 text-nb-peach-ink" size={14} aria-hidden />
          {t.failed}
        </p>
      ) : invoices.invoices.length === 0 ? (
        <Panel>
          <p className="py-3 text-[12.5px] text-nb-ink-soft">{t.empty}</p>
        </Panel>
      ) : (
        <Panel>
          <div className={`${COLS} border-b border-nb-ink/10 py-2 ${CAPTION} text-nb-ink-soft/80`}>
            <span>{t.date}</span>
            <span>{t.amount}</span>
            <span>{t.status}</span>
            <span />
          </div>
          {invoices.invoices.map((r) => (
            <div key={r.id} className={`${COLS} border-b border-nb-ink/10 py-2.5 text-[13px] text-nb-ink last:border-b-0`}>
              <span className="font-[600]">{day(r.date)}</span>
              <span className="tabular-nums">{money(r.amount, r.currency)}</span>
              <span>
                <span className={`${BADGE} ${tone[r.status]}`}>{label[r.status]}</span>
              </span>
              {/* Creem has no link to one receipt, so every row opens its billing portal. */}
              <button
                type="button"
                disabled={portal.busy}
                onClick={() => void portal.open()}
                className="inline-flex cursor-pointer items-center gap-1 text-[12.5px] font-[700] text-nb-accent-deep disabled:cursor-default disabled:opacity-60"
              >
                {t.receipt}
                <FiExternalLink size={12} aria-hidden />
              </button>
            </div>
          ))}
        </Panel>
      )}
      {portal.failed && (
        <p className={`${FAIL} mt-2`} role="alert">
          {all.plan.portalFailed}
        </p>
      )}
    </Group>
  );
}

// --- the plans page -----------------------------------------------------------

function Switch({ t, period, onPick }: { t: BillingCopy["pricing"]; period: Period; onPick: (p: Period) => void }) {
  const option = (value: Period, label: ReactNode) => (
    <button
      type="button"
      aria-pressed={period === value}
      onClick={() => onPick(value)}
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-[7px] px-3.5 py-1.5 text-[13px] font-[700] ${
        period === value ? "bg-nb-paper text-nb-ink shadow-[0_1px_3px_rgba(36,35,31,0.18)]" : "text-nb-ink-soft"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="inline-flex items-center gap-0.5 rounded-[10px] bg-nb-wash p-[3px]">
      {option("monthly", t.monthly)}
      {option(
        "yearly",
        <>
          {t.yearly}
          <span className="text-[11.5px] font-[800] text-nb-accent-deep">{t.save}</span>
        </>,
      )}
    </div>
  );
}

function Rows({ rows, lead }: { rows: string[]; lead?: string }) {
  return (
    <div className="mt-4 border-t border-nb-ink/10 pt-4">
      {lead && <p className="mb-2 text-[13px] font-[700] text-nb-ink">{lead}</p>}
      <ul className="space-y-1.5 text-[13px] leading-relaxed text-nb-ink">
        {rows.map((row) => (
          <li key={row} className="flex gap-2.5">
            <FiCheck className="mt-[3px] size-3.5 shrink-0 text-nb-accent" strokeWidth={3} aria-hidden />
            <span>{row}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Card({
  name,
  price,
  per,
  was,
  sub,
  action,
  children,
}: {
  name: string;
  price: string;
  per?: string;
  was?: string;
  sub: ReactNode;
  action: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-xl border border-nb-ink/12 bg-nb-paper px-6 pt-5 pb-10 shadow-[0_4px_14px_-8px_rgba(36,35,31,0.35)]">
      <h2 className="text-[18px] font-[800] tracking-tight">{name}</h2>
      <p className="mt-2.5 flex flex-wrap items-baseline gap-x-2">
        <span className="text-[34px] font-[800] leading-none tracking-tight tabular-nums">{price}</span>
        {per && <span className="text-[13px] text-nb-ink-soft">{per}</span>}
        {was && <s className="ml-1 text-[16px] text-nb-ink-soft">{was}</s>}
      </p>
      <p className="mt-1.5 min-h-5 text-[13px] text-nb-ink-soft">{sub}</p>
      {children}
      {action && <div className="relative mt-auto pt-5">{action}</div>}
    </section>
  );
}

function Plans({
  t,
  billing,
  onBack,
  onOpened,
}: {
  t: BillingCopy;
  billing: BillingRead;
  onBack: () => void;
  onOpened: () => void;
}) {
  const [period, setPeriod] = useState<Period>("yearly");
  const [checkout, setCheckout] = useState<"idle" | "opening" | "opened" | "failed">("idle");
  const p = t.pricing;
  const pro = period === "yearly" ? p.pro.yearly : p.pro.monthly;
  const known = billing.state === "ok";
  const onProNow = known && onPro(billing.billing);

  const buy = async () => {
    if (checkout === "opening") return;
    setCheckout("opening");
    try {
      const res = await startCheckoutAction(period);
      if (!res.ok) return setCheckout("failed");
      openLink(res.url);
      setCheckout("opened");
      onOpened();
    } catch {
      setCheckout("failed");
    }
  };

  const current = (
    <button type="button" disabled className={SLOT_BOX}>
      {t.plan.current}
    </button>
  );
  const proAction = !known ? (
    <p className={SLOT_BOX}>
      <FiAlertCircle size={14} aria-hidden />
      {t.plan.unavailable}
    </p>
  ) : onProNow ? (
    current
  ) : checkout === "opening" ? (
    <Button disabled className="w-full">
      {t.plan.opening}
    </Button>
  ) : (
    <>
      <Button className="w-full" onClick={() => void buy()}>
        {p.pro.button}
      </Button>
      {checkout === "opened" && (
        <p className={NOTE} aria-live="polite">
          {t.plan.opened}
        </p>
      )}
      {checkout === "failed" && (
        <p className={`${NOTE} !text-nb-peach-ink`} role="alert">
          {t.plan.checkoutFailed}
        </p>
      )}
    </>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="relative flex items-center justify-center">
        <button
          type="button"
          onClick={onBack}
          className="absolute left-0 inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-[700] text-nb-ink-soft hover:text-nb-ink"
        >
          <FiArrowLeft size={14} aria-hidden />
          {t.plan.back}
        </button>
        <Switch t={p} period={period} onPick={setPeriod} />
      </div>
      <div className="grid grid-cols-2 gap-5 max-sm:grid-cols-1">
        <Card
          name={p.free.name}
          price={p.free.price}
          sub={p.free.tagline}
          action={known && !onProNow && current}
        >
          <Rows rows={p.free.rows} />
        </Card>
        <Card
          name={p.pro.name}
          price={pro.price}
          per={pro.per}
          was={period === "yearly" ? p.pro.yearly.was : undefined}
          sub={period === "yearly" ? p.pro.yearly.sub : ""}
          action={proAction}
        >
          <Rows rows={p.pro.rows} lead={p.pro.leadIn} />
        </Card>
      </div>
    </div>
  );
}
