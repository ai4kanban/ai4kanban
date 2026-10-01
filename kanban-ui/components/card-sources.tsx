"use client";

import Link from "next/link";
import { useState } from "react";
import { FiExternalLink } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import { useActions } from "@/lib/screen";
import type { SourceDocument, SourceLink } from "@/lib/types";
import { useCardHref } from "./board-links";
import { Dialog } from "./Dialog";
import { Markdown } from "./Markdown";

// One word naming the kind, never the title or a path (#1306); the title is the tooltip.
// `max-md:h-9` is the thumb's target at phone width.
const WORD =
  "inline-flex cursor-pointer items-center text-[12px] font-[700] leading-[15px] text-nb-ink underline decoration-nb-ink/25 underline-offset-[3px] hover:decoration-nb-ink max-md:h-9";

/** Where a card came from, as the links its meta strip holds. A plan or a triage item opens
 *  here, in a dialog; a card goes to its page and an address to a new tab. */
export function SourceLinks({ cardId, sources }: { cardId: number; sources: SourceLink[] }) {
  const t = useCopy();
  const c = t.card.meta;
  const actions = useActions();
  const cardHref = useCardHref();
  const [open, setOpen] = useState<{ label: string; doc: SourceDocument } | null>(null);

  const read = async (source: SourceLink, label: string) => {
    const doc = await actions?.readCardSource?.(cardId, source.kind, source.ref);
    if (doc) setOpen({ label, doc });
  };

  return (
    <>
      {sources.map((source) => {
        const key = `${source.kind}:${source.ref}`;
        if (source.kind === "card") {
          return (
            <Link
              key={key}
              href={source.archived ? `/archive/${source.ref}` : cardHref(Number(source.ref))}
              title={source.title || undefined}
              className="inline-flex items-center max-md:h-9"
            >
              <span
                className="nb-chip"
                style={{ background: "color-mix(in srgb, var(--color-nb-ink) 7%, transparent)", color: "var(--color-nb-ink-soft)" }}
              >
                #{source.ref}
              </span>
            </Link>
          );
        }
        if (source.kind === "url") {
          return (
            <a key={key} href={source.ref} target="_blank" rel="noreferrer noopener" title={source.title || undefined} className={WORD}>
              {c.sourceLink}
            </a>
          );
        }
        const label = source.kind === "plan" ? c.sourcePlan : t.rail.signals.row;
        // No way to read it from here means no link: a word that opens nothing is noise.
        if (!actions?.readCardSource) return null;
        return (
          <button key={key} type="button" title={source.title || undefined} className={WORD} onClick={() => void read(source, label)}>
            {label}
          </button>
        );
      })}
      {open && (
        <Dialog title={open.doc.title || open.label} width={720} onClose={() => setOpen(null)}>
          {open.doc.url && (
            <a
              href={open.doc.url}
              target="_blank"
              rel="noreferrer noopener"
              className="mb-3 inline-flex max-w-full items-center gap-1 text-[12px] underline decoration-nb-ink-soft decoration-1 underline-offset-[3px] hover:decoration-nb-ink"
            >
              <span className="truncate">{open.doc.url}</span>
              <FiExternalLink size={11} className="shrink-0 text-nb-ink-soft" aria-hidden />
            </a>
          )}
          <Markdown body={open.doc.text} />
        </Dialog>
      )}
    </>
  );
}
