// The card page's sheet, drawn the same on the review page and in WildCrane Web (#2062): the
// title, a row under it with the status on the left and the actions on the right, the meta
// strip, and the body with the previews it does not name. Each page brings its own shell, AI
// bubble and comments rail.

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FiFeather, FiLock, FiPlay, FiXCircle } from "react-icons/fi";
import { COPY } from "../i18n";
import type { Previews } from "../lib/artifacts";
import type { CardMeta } from "../lib/card-info";
import { useDraft } from "../lib/draft";
import { bodySources } from "../lib/mockup-tag";
import { cn } from "../lib/utils";
import { Button } from "./button";
import { CardBody } from "./CardBody";
import { HAIRLINE, QUIET } from "./chrome";
import { LevelSelect, ModuleChip } from "./chips";
import { PreviewOf, type CardLink } from "./Markdown";

const CAP = "text-[10px] font-[700] uppercase tracking-[0.08em] text-nb-ink-soft";
const GREY = { background: "color-mix(in srgb, var(--color-nb-ink) 7%, transparent)", color: "var(--color-nb-ink-soft)" };
const ICON = { width: 10, height: 10, flex: "0 0 auto" };

// One meta column: micro-caption stacked over its value. Columns flow horizontally and wrap,
// so the box stays one shallow band. Every value is chip-height and chip-size, so rows align.
function MetaItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className={CAP}>{label}</span>
      <div className="flex min-h-[15px] flex-wrap items-center gap-1.5 text-[10px] font-[700] leading-none tracking-[0.04em] text-nb-ink">{children}</div>
    </div>
  );
}

function TodoProgress({ done, total }: { done: number; total: number }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      <span style={{ display: "block", width: 48, height: 4, borderRadius: 999, overflow: "hidden", background: "color-mix(in srgb, var(--color-nb-ink) 12%, transparent)" }}>
        <span style={{ display: "block", height: "100%", width: `${Math.round((done / Math.max(total, 1)) * 100)}%`, background: done >= total ? "var(--color-nb-mint)" : "var(--color-nb-accent)" }} />
      </span>
      <span className="text-[10.5px] font-[700] tabular-nums text-nb-ink-soft">
        {done}/{total}
      </span>
    </span>
  );
}

export type Info = CardMeta & {
  workflow: string;
  project?: string | null;
  /** Shown last: 发起 on the card page; 发起人 and 链接到期 on the review page. */
  more: { label: string; value: ReactNode }[];
  /** A source, blocker or related ref the page opens, as its link around the chip; null leaves it plain. */
  chipLink?: (ref: string, chip: ReactNode) => ReactNode | null;
};

export function InfoBar({ info }: { info: Info }) {
  const m = COPY.meta;
  return (
    <div className="nb-section relative flex flex-wrap items-start gap-x-7 gap-y-3 bg-nb-sheet px-4 py-3.5 max-md:grid max-md:grid-cols-2 max-md:gap-x-4 max-md:px-3.5 max-md:py-3">
      <MetaItem label={m.workflow}>{info.workflow}</MetaItem>
      {info.project && <MetaItem label={m.project}>{info.project}</MetaItem>}
      {info.modules.length > 0 && (
        <MetaItem label={m.modules}>
          {info.modules.map((x) => (
            <ModuleChip key={x} module={x} />
          ))}
        </MetaItem>
      )}
      {info.priority && (
        <MetaItem label={m.priority}>
          <LevelSelect value={info.priority} label={COPY.level[info.priority] ?? info.priority} />
        </MetaItem>
      )}
      {info.todos && (
        <MetaItem label={m.todos}>
          <TodoProgress done={info.todos.done} total={info.todos.total} />
        </MetaItem>
      )}
      {info.source.length > 0 && (
        <MetaItem label={m.source}>
          {info.source.map((s) => {
            const chip = (
              <span key={s} className="nb-chip" style={GREY}>
                {s}
              </span>
            );
            return info.chipLink?.(s, chip) ?? chip;
          })}
        </MetaItem>
      )}
      {info.blockedBy.length > 0 && (
        <MetaItem label={m.blockedBy}>
          {info.blockedBy.map((s) => {
            const chip = (
              <span key={s} className="nb-chip" style={{ background: "var(--color-nb-peach-soft)", color: "var(--color-nb-peach-ink)" }}>
                <FiLock aria-hidden style={ICON} />
                {s}
              </span>
            );
            return info.chipLink?.(s, chip) ?? chip;
          })}
        </MetaItem>
      )}
      {info.related.length > 0 && (
        <MetaItem label={m.related}>
          {info.related.map((s) => {
            const chip = (
              <span key={s} className="nb-chip" style={GREY}>
                {s}
              </span>
            );
            return info.chipLink?.(s, chip) ?? chip;
          })}
        </MetaItem>
      )}
      {info.more.map((x) => (
        <MetaItem key={x.label} label={x.label}>
          {x.value}
        </MetaItem>
      ))}
    </div>
  );
}

export function CardSheet({
  number,
  title,
  status,
  actions,
  info,
  above,
  below,
  body,
  previews,
  nameOf,
  cardLink,
  empty,
}: {
  number?: string;
  title: string;
  status?: ReactNode;
  actions?: ReactNode;
  info: Info;
  /** Over the meta strip: the run log. */
  above?: ReactNode;
  /** Between the meta strip and the body: notices and the open question. */
  below?: ReactNode;
  /** The card's markdown with its title taken off; null before there is a card. */
  body: string | null;
  previews: Previews;
  /** A preview section's name, from its agent id. */
  nameOf?: (agent: string) => string;
  /** Where a `#12` in the body goes; without it every one stays text. */
  cardLink?: CardLink;
  /** Drawn in place of a missing body. */
  empty: ReactNode;
}) {
  const extra = useMemo(() => previews.unreferenced(body ? bodySources(body) : []), [previews, body]);
  const more = extra.length > 0 && <Extra ids={extra.map((a) => a.id)} previews={previews} />;
  return (
    <main className="mx-auto flex w-full max-w-[840px] flex-col gap-6 px-6 py-6 max-md:gap-5 max-md:px-4 max-md:py-4">
      <div className="flex flex-col gap-3 max-md:gap-2.5">
        <h1 className="min-w-0 break-words text-[20px] font-[800] leading-[28px] tracking-[-0.02em]">
          {number && (
            <span className="mr-2.5 max-md:mr-2" style={{ color: "var(--color-nb-accent-deep)" }}>
              {number}
            </span>
          )}
          {title}
        </h1>
        {(status || actions) && (
          <div className="flex items-center gap-1">
            {status}
            <span className="relative ml-auto flex shrink-0 items-center gap-1">{actions}</span>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-4">
        {above}
        <InfoBar info={info} />
        {below}
        {body !== null ? (
          <CardBody body={body} previews={previews} nameOf={nameOf} cardLink={cardLink} afterBody={more} />
        ) : (
          <>
            {empty}
            {more && <div className="nb-section bg-nb-sheet p-5 max-md:p-4">{more}</div>}
          </>
        )}
      </div>
    </main>
  );
}

/** The review's artifacts the body does not name, drawn the same way, after it. */
function Extra({ ids, previews }: { ids: string[]; previews: Previews }) {
  return (
    <div className="nb-md">
      <h2>{COPY.previews}</h2>
      {ids.map((id) => (
        <PreviewOf key={id} view={previews.viewOfArtifact(id)} />
      ))}
    </div>
  );
}

/** 执行, or 细化 while another plan stage is still to be approved. */
export function RunButton({ refine, busy, onClick }: { refine: boolean; busy: boolean; onClick: () => void }) {
  return (
    <Button size="xs" className="ml-2" disabled={busy} onClick={onClick}>
      {refine ? <FiFeather className="text-[14px]" aria-hidden /> : <FiPlay className="text-[14px]" aria-hidden />}
      {refine ? COPY.act.refine : COPY.act.implement}
    </Button>
  );
}

/** Another approval follows the current one. */
export const refining = (at: { round?: number | null; rounds?: number } | null | undefined) =>
  !!at?.rounds && Math.max(at.round || 1, 1) < at.rounds;

/** 移除: an icon, then a confirm under it with an optional reason. */
export function RemoveButton({ busy, onRemove, draftKey }: { busy: boolean; onRemove: (reason?: string) => Promise<boolean>; draftKey?: string }) {
  const a = COPY.act;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useDraft(draftKey);
  const box = useRef<HTMLSpanElement>(null);
  // On a phone the anchored 320px panel can run off the left edge; span the screen instead.
  const [wide, setWide] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = box.current?.getBoundingClientRect();
      const w = document.documentElement.clientWidth;
      setWide(r && matchMedia("(max-width: 767px)").matches ? { left: 12 - r.left, width: w - 24 } : null);
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <span ref={box} className="relative flex">
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={a.remove}
        title={a.remove}
        className={cn(QUIET, "w-7 px-0 text-nb-ink-soft", open && "bg-nb-wash text-nb-ink")}
      >
        <FiXCircle className="text-[14px]" aria-hidden />
      </button>
      {open && (
        <div
          role="dialog"
          className="nb-panel nb-pop origin-top-right absolute right-0 top-[calc(100%+6px)] z-20 w-[320px] max-w-[calc(100vw-24px)] bg-nb-paper p-3"
          style={wide ? { left: wide.left, right: "auto", width: wide.width, maxWidth: "none" } : undefined}
        >
          <p className="text-[13px] font-[700]">{a.removeAsk}</p>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={2000}
            placeholder={a.removeWhy}
            aria-label={a.removeWhy}
            className="mt-2.5 block w-full resize-none rounded-[8px] border bg-nb-paper px-2.5 py-2 text-[12.5px] leading-snug text-nb-ink outline-none placeholder:text-nb-ink-soft max-md:text-[16px]"
            style={{ borderColor: HAIRLINE }}
          />
          <p className="mt-1.5 text-[12px] leading-snug text-nb-ink-soft">{a.removeHint}</p>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="xs" onClick={() => setOpen(false)}>
              {a.keep}
            </Button>
            <Button
              size="xs"
              onClick={async () => {
                setOpen(false);
                if (await onRemove(reason.trim() || undefined)) setReason("");
              }}
            >
              {reason.trim() ? a.remove : a.discard}
            </Button>
          </div>
        </div>
      )}
    </span>
  );
}
