// 设置 → 账单 (#2080), after legacy kanban-ui/components/Billing.tsx's Summary and Credits: the
// plan row, one row per figure, then the AI capabilities credits pay for (#77), each with its
// credits per tier (#87). Read-only:
// upgrading opens the pricing page and everything about a subscription opens the billing
// portal, both in a new tab.

import { useCallback, useEffect, useRef, useState } from "react";
import { FiAlertCircle, FiExternalLink, FiImage, FiMic, FiMusic, FiRefreshCw } from "react-icons/fi";
import { Button } from "@review/components/button";
import * as api from "../api";
import { LANG, T } from "../i18n";
import { Group } from "./Welcome";

const BADGE = "rounded-[6px] px-1.5 py-[3px] text-[11px] font-[700] leading-none";
const MINT = "bg-nb-mint-soft text-nb-mint-ink";
const QUIET = "bg-nb-ink/7 text-nb-ink-soft";
const PEACH = "bg-nb-peach-soft text-nb-peach-ink";
const ROW = "flex items-center justify-between gap-6 border-b border-nb-ink/10 py-3.5";
const QUIET_BTN =
  "inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[9px] bg-nb-wash px-2.5 py-1.5 text-[12px] font-[700] text-nb-ink transition-[background-color,transform] duration-100 hover:bg-nb-canvas active:scale-[0.97] nb-focus";

const subscribed = (b: api.Billing) => b.state === "active" || b.state === "canceled" || b.state === "pastDue";
const daysLeft = (end: string) => Math.max(1, Math.ceil((Date.parse(end) - Date.now()) / 86_400_000));
const num = (n: number) => new Intl.NumberFormat("en-US").format(n);
/** `UTC` for a date the cloud fixes in UTC, so it never reads as the day before west of it. */
const day = (iso: string, timeZone?: "UTC") =>
  new Intl.DateTimeFormat(LANG === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: LANG === "zh" ? "long" : "short", day: "numeric", timeZone }).format(new Date(iso));
const MB = 1024 * 1024;
const GB = 1024 * MB;
const size = (bytes: number) => {
  const [n, unit] = bytes >= GB ? [bytes / GB, "GB"] : [bytes / MB, "MB"];
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(n)} ${unit}`;
};

export function BillingPanel() {
  const [read, setRead] = useState<api.BillingRead | null>(null);
  const [failed, setFailed] = useState(false);
  const asked = useRef(0);

  const load = useCallback(async () => {
    const mine = ++asked.current;
    try {
      const r = await api.readBilling();
      if (mine !== asked.current) return;
      setRead(r);
      setFailed(false);
    } catch {
      if (mine === asked.current) setFailed(true);
    }
  }, []);

  // Read again when the window comes back, to show what the pricing page or the portal changed.
  useEffect(() => {
    void load();
    const onFocus = () => void load();
    const onShow = () => document.visibilityState === "visible" && void load();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onShow);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [load]);

  if (failed && !read)
    return (
      <div className={`${ROW} pt-0 pb-4`}>
        <p className="flex items-center gap-2 text-[13.5px] text-nb-ink-soft">
          <FiAlertCircle size={14} className="shrink-0" aria-hidden />
          {T.billing.failed}
        </p>
        <button type="button" className={QUIET_BTN} onClick={() => void load()}>
          <FiRefreshCw className="text-[12px]" aria-hidden />
          {T.billing.retry}
        </button>
      </div>
    );
  if (!read) return null;

  const t = T.billing;
  const { credits, quota } = read;
  return (
    <>
      <div className="flex flex-col">
        <PlanRow billing={read.billing} />
        {credits && (
          <Figure
            label={t.credits}
            value={num(credits.left)}
            cap={num(credits.total)}
            note={credits.resetsAt ? t.resets(day(credits.resetsAt, "UTC")) : t.noReset}
            over={credits.left === 0}
          />
        )}
        <Figure label={t.tasks} value={String(quota.used.tasks)} cap={String(quota.limits.tasks)} over={quota.used.tasks >= quota.limits.tasks} />
        <Figure label={t.storage} value={size(quota.used.storage)} cap={size(quota.limits.storage)} over={quota.used.storage >= quota.limits.storage} />
      </div>
      <AiUses rates={read.rates} />
    </>
  );
}

const AI_ICONS = [FiImage, FiMic, FiMusic];

function AiUses({ rates }: { rates?: api.CreditRates }) {
  const t = T.billing;
  const prices = rates && [Object.values(rates.image), Object.values(rates.speech), [rates.music]];
  return (
    <div className="mt-7">
      <Group title={t.ai}>
        {t.aiUses.map(({ name, hint, tiers, unit }, i) => {
          const Icon = AI_ICONS[i]!;
          const credits = prices?.[i];
          return (
            <div key={name} className="flex items-start gap-3 border-b border-nb-ink/10 py-3 last:border-b-0">
              <Icon size={16} className="mt-px shrink-0 text-nb-ink-soft" aria-hidden />
              <div className="flex min-w-0 flex-1 items-start justify-between gap-6 max-md:flex-col max-md:gap-2">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-[700] leading-tight text-nb-ink">{name}</p>
                  <p className="mt-1 max-w-[62ch] text-[12px] leading-snug text-nb-ink-soft">{hint}</p>
                </div>
                {credits && (
                  <div className="shrink-0 text-right max-md:text-left">
                    <p className="text-[13px] leading-tight tabular-nums">
                      {tiers.map((tier, n) => (
                        <span key={tier}>
                          {n > 0 && <span className="text-nb-ink/25"> · </span>}
                          {tier && <span className="text-nb-ink-soft">{tier} </span>}
                          <span className="font-[700] text-nb-ink">{credits[n]}</span>
                        </span>
                      ))}
                    </p>
                    <p className="mt-1 text-[12px] leading-snug text-nb-ink-soft">{unit}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </Group>
      <p className="mt-2 px-1 text-[12px] leading-snug text-nb-ink-soft">{t.aiNote}</p>
    </div>
  );
}

/** Open the billing portal in a new tab. The tab opens on the click, before the link is back,
 *  so no popup blocker stops it. */
function usePortal() {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const open = async () => {
    if (busy) return;
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;
    setBusy(true);
    setFailed(false);
    try {
      const url = await api.openBillingPortal();
      if (tab) tab.location.href = url;
      else window.open(url, "_blank", "noopener");
    } catch {
      tab?.close();
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return { busy, failed, open };
}

function PlanRow({ billing: b }: { billing: api.Billing }) {
  const t = T.billing;
  const portal = usePortal();
  const paying = subscribed(b);
  const trial = !!b.trialEnd && !b.grantEnd && !paying;
  const gift = !!b.grantEnd && !paying;
  const badge =
    trial ? [t.trial, MINT]
    : gift ? [t.gifted, MINT]
    : b.state === "active" ? [t.active, MINT]
    : b.state === "canceled" ? [t.cancelled, QUIET]
    : b.state === "pastDue" ? [t.pastDue, PEACH]
    : null;
  const line =
    trial ? `${t.trialLeft(daysLeft(b.trialEnd!))} · ${t.trialEnds(day(b.trialEnd!))}`
    : gift ? t.giftedUntil(day(b.grantEnd!))
    : b.state === "active" && b.periodEnd ? t.renews(day(b.periodEnd))
    : b.state === "canceled" && b.periodEnd ? t.ends(day(b.periodEnd))
    : b.state === "expired" && b.periodEnd ? t.ended(day(b.periodEnd))
    : null;
  const ext = <FiExternalLink aria-hidden className="text-[12px]" />;
  const action =
    b.state === "pastDue" ? (
      <Button size="sm" disabled={portal.busy} onClick={() => void portal.open()}>
        {t.updatePayment}
        {ext}
      </Button>
    ) : b.state === "active" || b.state === "canceled" ? (
      <Button size="sm" variant="ghost" disabled={portal.busy} onClick={() => void portal.open()}>
        {t.manage}
        {ext}
      </Button>
    ) : trial ? null : (
      <Button size="sm" onClick={() => window.open(api.PRICING_URL, "_blank", "noopener")}>
        {t.upgrade}
        {ext}
      </Button>
    );

  return (
    <div className={`${ROW} pt-0 pb-4 max-md:flex-wrap max-md:gap-3`}>
      <div className="min-w-0">
        <p className="flex items-center gap-2">
          <span className="text-[16px] font-[800] tracking-[-0.01em] text-nb-ink">{b.plan === "pro" ? t.pro : t.free}</span>
          {badge && <span className={`${BADGE} ${badge[1]}`}>{badge[0]}</span>}
        </p>
        {b.state === "pastDue" ? (
          <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-nb-peach-ink" role="status">
            <FiAlertCircle size={13} className="shrink-0" aria-hidden />
            {t.updatePaymentBody}
          </p>
        ) : (
          line && <p className="mt-1 text-[12.5px] text-nb-ink-soft">{line}</p>
        )}
      </div>
      {action && (
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {action}
          {portal.failed && (
            <p className="text-[12px] font-[700] text-nb-peach-ink" role="alert">
              {t.portalFailed}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** One figure: its name (and a quiet note) on the left, used / cap on the right. `over` turns it peach. */
function Figure({ label, value, cap, note, over }: { label: string; value: string; cap: string; note?: string; over?: boolean }) {
  return (
    <div className={ROW}>
      <div className="min-w-0">
        <p className="text-[13.5px] text-nb-ink">{label}</p>
        {note && <p className="mt-0.5 truncate text-[12px] text-nb-ink-soft">{note}</p>}
      </div>
      <p className="shrink-0 text-[13.5px] tabular-nums">
        <span className={`font-[700] ${over ? "text-nb-peach-ink" : "text-nb-ink"}`}>{value}</span>
        <span className="text-nb-ink-soft"> / {cap}</span>
      </p>
    </div>
  );
}
