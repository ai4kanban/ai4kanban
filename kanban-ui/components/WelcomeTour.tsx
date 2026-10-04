"use client";

// The welcome tour (#1500): five pages, each a loop and a sentence on what the board does
// that a bare coding agent doesn't. It opens once per machine (per browser on Cloud), and
// again from Help → Welcome tour and Configuration → General.

import { useCallback, useEffect, useRef, useState } from "react";
import { FiChevronDown, FiChevronRight } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import { useMatches, usePhone } from "@/lib/media";
import { browserTourRecord, welcomeTour } from "@/lib/welcome-tour";
import { Button } from "./button";
import { useOpenTourFromApp } from "./desktop";
import { Dialog, DialogCard } from "./Dialog";
import { Group, Panel } from "./settings";
import { TOUR_ART } from "./tour-art";

const WASH = ["bg-nb-accent-wash", "bg-nb-mint-soft", "bg-nb-sky-soft", "bg-nb-lilac-soft", "bg-nb-peach-soft"];

// The switch (#1518) shuffles a deck: going on, the front card slides off left and tucks in at
// the back while the one under it rises; going back, the back card comes out left and lands on
// top. Every card is one page, so a quick second press retargets cards mid-move. A card that
// passes the front flies in two legs, out and in, swapping its depth at the turn.
const LEG = 200;
const EASE = "cubic-bezier(.3,.7,.2,1)";
const SLOT = ["none", "translate(7px,6px) rotate(1deg)", "translate(14px,12px) rotate(2deg)"];
const OUT = "translate(-560px,24px) rotate(-6deg)";
const PHONE_PAST = "translateX(-110%) rotate(-4deg)";
const PHONE_NEXT = "scale(.94)";

type Flight = { dir: "out" | "in"; leg: 1 | 2 };

/** The dialog. Every way out — Get started, Skip, ✕, Esc — is `onClose`. */
export function WelcomeTour({ onClose }: { onClose: () => void }) {
  const c = useCopy().tour;
  const phone = usePhone();
  const still = useMatches("(prefers-reduced-motion: reduce)");
  const [page, setPage] = useState(0);
  const [noteOpen, setNoteOpen] = useState(false);
  // Card → its flight in progress; the card that just left the front, too, on a phone.
  const [flights, setFlights] = useState<Record<number, Flight>>({});
  // How often each page has come to the front: its art restarts from the top each time.
  const [visits, setVisits] = useState<number[]>(() => c.pages.map(() => 0));
  const timers = useRef<number[]>([]);
  const refocus = useRef<string | undefined>(undefined);
  const total = c.pages.length;

  const go = useCallback(
    (to: number) => {
      to = Math.max(0, Math.min(total - 1, to));
      if (to === page) return;
      refocus.current = (document.activeElement as HTMLElement | null)?.dataset?.tour;
      setPage(to);
      setNoteOpen(false);
      setVisits((v) => v.map((n, i) => (i === to ? n + 1 : n)));
      if (still) return;
      const card = to > page ? page : to;
      if (flights[card]) return;
      const after = (ms: number, f: (rest: Record<number, Flight>) => Record<number, Flight>) =>
        timers.current.push(window.setTimeout(() => setFlights(f), ms));
      setFlights((f) => ({ ...f, [card]: { dir: to > page ? "out" : "in", leg: 1 } }));
      after(LEG, (f) => (f[card] ? { ...f, [card]: { ...f[card], leg: 2 } } : f));
      after(2 * LEG, (f) => Object.fromEntries(Object.entries(f).filter(([k]) => +k !== card)));
    },
    [total, page, still, flights],
  );

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(page + 1);
      if (e.key === "ArrowLeft") go(page - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, page]);

  // The control just pressed went with its card; the same one on the new front card takes focus.
  useEffect(() => {
    const role = refocus.current;
    refocus.current = undefined;
    if (!role) return;
    const front = document.querySelector(`[data-tour-card="${page}"]`);
    (front?.querySelector<HTMLElement>(`[data-tour="${role}"]`) ?? front?.querySelector<HTMLElement>('[data-tour="next"]'))?.focus();
  }, [page]);

  const card = (i: number) => {
    const flight = flights[i];
    let transform: string;
    let z: number;
    let shown: boolean;
    if (phone) {
      transform = i < page ? PHONE_PAST : i > page ? PHONE_NEXT : "none";
      z = total - i;
      shown = Math.abs(i - page) <= 1 || !!flight;
    } else {
      const slot = (i - page + total) % total;
      const flying = flight?.leg === 1;
      transform = flying ? OUT : SLOT[Math.min(slot, 2)];
      z = flying ? (flight.dir === "out" ? total + 1 : 0) : total - slot;
      shown = slot === 0 || (slot === 1 && i === page + 1) || !!flight;
    }
    return (
      <DialogCard
        key={i}
        title={c.dialog}
        onClose={onClose}
        data-tour-card={i}
        inert={i !== page}
        className={phone ? "shadow-[0_8px_24px_rgba(0,0,0,.18)]" : ""}
        style={{
          transform,
          zIndex: z,
          filter: phone && i > page ? "brightness(.9)" : undefined,
          transition: still ? "none" : `transform ${flight && !phone ? LEG : 2 * LEG}ms ${EASE}, filter ${2 * LEG}ms ${EASE}`,
        }}
      >
        {shown && face(i)}
      </DialogCard>
    );
  };

  const face = (i: number) => {
    const p = c.pages[i];
    const Art = TOUR_ART[i];
    const last = i === total - 1;
    const note = noteOpen && i === page;
    return (
      <>
        <div className={`flex min-h-0 flex-1 ${phone ? "flex-col overflow-y-auto" : ""}`}>
          <div
            className={`grid shrink-0 place-items-center overflow-hidden border-nb-ink ${WASH[i]} ${
              phone ? "h-[330px] border-b-[1.5px]" : "w-[420px] max-w-[50%] border-r-[1.5px]"
            }`}
          >
            {/* Keyed on the visit, so each loop starts from its beginning. */}
            <div key={visits[i]} className="max-[400px]:scale-90">
              <Art copy={c} />
            </div>
          </div>
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
                  aria-expanded={note}
                  onClick={() => setNoteOpen((o) => !o)}
                  className="inline-flex cursor-pointer items-center gap-1 text-[12px] font-[700] text-nb-ink-soft hover:text-nb-ink"
                >
                  {note ? <FiChevronDown aria-hidden /> : <FiChevronRight aria-hidden />}
                  {c.noteLabel}
                </button>
                {note && (
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
            {c.pages.map((pg, j) => (
              <button
                key={pg.title}
                type="button"
                data-tour={`dot-${j}`}
                aria-label={pg.title}
                aria-current={j === i}
                onClick={() => go(j)}
                className={`h-[8px] cursor-pointer rounded-full border-[1.5px] border-nb-ink transition-[width] duration-150 ${
                  j === i ? "w-[22px] bg-nb-accent" : "w-[8px] bg-nb-paper"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {i > 0 && (
              <Button variant="ghost" size="sm" data-tour="back" onClick={() => go(i - 1)}>
                {c.back}
              </Button>
            )}
            <Button size="sm" data-tour="next" onClick={last ? onClose : () => go(i + 1)}>
              {last ? c.done : c.next}
            </Button>
          </div>
        </div>
      </>
    );
  };

  return (
    <Dialog title={c.dialog} onClose={onClose} width={860} height={500} deck>
      {c.pages.map((_, i) => card(i))}
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
