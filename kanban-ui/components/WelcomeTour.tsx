"use client";

// The welcome tour (#1500): five pages, each a loop and a sentence on what the board does
// that a bare coding agent doesn't. It opens once per machine (per browser on Cloud), and
// again from Help → Welcome tour and Configuration → General.

import { useCallback, useEffect, useState } from "react";
import { FiChevronDown, FiChevronRight } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import { usePhone } from "@/lib/media";
import { browserTourRecord, welcomeTour } from "@/lib/welcome-tour";
import { Button } from "./button";
import { useOpenTourFromApp } from "./desktop";
import { Dialog } from "./Dialog";
import { Group, Panel } from "./settings";
import { TOUR_ART } from "./tour-art";

const WASH = ["bg-nb-accent-wash", "bg-nb-mint-soft", "bg-nb-sky-soft", "bg-nb-lilac-soft", "bg-nb-peach-soft"];

/** The dialog. Every way out — Get started, Skip, ✕, Esc — is `onClose`. */
export function WelcomeTour({ onClose }: { onClose: () => void }) {
  const c = useCopy().tour;
  const phone = usePhone();
  const [page, setPage] = useState(0);
  const [noteOpen, setNoteOpen] = useState(false);
  const total = c.pages.length;
  const last = page === total - 1;
  const go = useCallback(
    (to: number) => {
      setPage(Math.max(0, Math.min(total - 1, to)));
      setNoteOpen(false);
    },
    [total],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(page + 1);
      if (e.key === "ArrowLeft") go(page - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, page]);

  const p = c.pages[page];
  const Art = TOUR_ART[page];
  const art = (
    <div
      className={`grid shrink-0 place-items-center overflow-hidden border-nb-ink ${WASH[page]} ${
        phone ? "h-[330px] border-b-[1.5px]" : "w-[420px] max-w-[50%] border-r-[1.5px]"
      }`}
    >
      {/* Keyed on the page, so each loop starts from its beginning. */}
      <div key={page} className="max-[400px]:scale-90">
        <Art copy={c} />
      </div>
    </div>
  );

  return (
    <Dialog title={c.dialog} onClose={onClose} width={860} height={500} flush deck={!phone}>
      <div className="flex min-h-0 w-full flex-1 flex-col">
        <div className={`flex min-h-0 flex-1 ${phone ? "flex-col overflow-y-auto" : ""}`}>
          {art}
          <div className={`flex min-w-0 flex-1 flex-col ${phone ? "px-6 py-6" : "overflow-y-auto px-8 py-8"}`}>
            <p className="text-[13px] leading-[20px] text-nb-ink-soft">{p.pain}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <h3 className="text-[24px] font-[850] leading-[1.2] tracking-[-0.02em]">{p.title}</h3>
              {p.tag && <span className="nb-tag">{p.tag}</span>}
            </div>
            <p className="mt-4 text-[15px] leading-[25px]">{p.value}</p>
            {p.note && (
              <div className="mt-auto pt-6">
                <button
                  type="button"
                  aria-expanded={noteOpen}
                  onClick={() => setNoteOpen((o) => !o)}
                  className="inline-flex cursor-pointer items-center gap-1 text-[12px] font-[700] text-nb-ink-soft hover:text-nb-ink"
                >
                  {noteOpen ? <FiChevronDown aria-hidden /> : <FiChevronRight aria-hidden />}
                  {c.noteLabel}
                </button>
                {noteOpen && (
                  <p className="mt-2 rounded-[8px] bg-nb-wash px-3 py-2.5 text-[12px] leading-[19px] text-nb-ink-soft">
                    {p.note}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
        <div
          className={`flex shrink-0 items-center justify-between gap-3 border-t border-nb-ink/12 px-5 pt-3 ${
            phone ? "pb-[max(12px,env(safe-area-inset-bottom))]" : "pb-3"
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer text-[13px] font-[650] text-nb-ink-soft hover:text-nb-ink"
          >
            {c.skip}
          </button>
          <div className="flex items-center gap-1.5">
            {c.pages.map((pg, i) => (
              <button
                key={pg.title}
                type="button"
                aria-label={pg.title}
                aria-current={i === page}
                onClick={() => go(i)}
                className={`h-[8px] cursor-pointer rounded-full border-[1.5px] border-nb-ink transition-[width] duration-150 ${
                  i === page ? "w-[22px] bg-nb-accent" : "w-[8px] bg-nb-paper"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {page > 0 && (
              <Button variant="ghost" size="sm" onClick={() => go(page - 1)}>
                {c.back}
              </Button>
            )}
            <Button size="sm" onClick={last ? onClose : () => go(page + 1)}>
              {last ? c.done : c.next}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

/** The first open (#1500): up by itself while it is owed, recorded on any way out. Without a
 *  `record` of the machine's, the browser keeps it. */
export function TourOnFirstOpen({ owed, record }: { owed?: boolean; record?: () => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(record ? owed === true : !browserTourRecord.shown());
  }, [owed, record]);
  if (!open) return null;
  return (
    <WelcomeTour
      onClose={() => {
        setOpen(false);
        (record ?? browserTourRecord.record)();
      }}
    />
  );
}

/** The tour asked for again — Help → Welcome tour in the app, or the row below. */
export function TourOnRequest() {
  const [open, setOpen] = useState(false);
  const show = useCallback(() => setOpen(true), []);
  useEffect(() => welcomeTour.onOpen(show), [show]);
  useOpenTourFromApp(show);
  return open ? <WelcomeTour onClose={() => setOpen(false)} /> : null;
}

/** Configuration → General's row, and Cloud's settings page. `onOpen` draws the tour where
 *  no `TourOnRequest` is mounted. */
export function TourGroup({ onOpen = welcomeTour.open }: { onOpen?: () => void }) {
  const c = useCopy().tour;
  return (
    <Group title={c.dialog}>
      <Panel>
        <div className="flex items-center justify-between gap-5 py-3 max-sm:flex-col max-sm:items-start max-sm:gap-2.5">
          <p className="max-w-[56ch] text-[12px] leading-snug text-nb-ink-soft">{c.replay.note}</p>
          <Button variant="ghost" size="sm" className="shrink-0" onClick={onOpen}>
            {c.replay.button}
          </Button>
        </div>
      </Panel>
    </Group>
  );
}
