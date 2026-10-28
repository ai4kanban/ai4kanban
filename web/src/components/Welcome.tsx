// The first visit (#2132): the usage notice, then the welcome tour over the page, then the setup
// page until it is finished. The notice and the tour show once per browser; 设置 → 通用 replays the
// tour and holds the notice's switch. The switch is only remembered: nothing is reported yet.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { FiChevronDown, FiChevronRight, FiShield, FiX } from "react-icons/fi";
import { Button } from "@review/components/button";
import { Loading } from "@review/components/Notice";
import { LogoMark } from "@review/components/Logo";
import { cn } from "@review/lib/utils";
import * as api from "../api";
import { F } from "../first-run-i18n";
import { T } from "../i18n";
import { useNarrow } from "../lib/narrow";
import { SetupPage, setupLooksDone } from "./Setup";
import { TOUR_ART } from "./tour-art";

const PRIVACY_URL = "https://wildcrane.ai/privacy";
const NOTICE_SEEN = "wc.usageNoticeShown";
const TOUR_SEEN = "wc.welcomeTourShown";
const SHARE = "wc.shareUsage";
const setupKey = (account: string | null) => `wc.setupDone.${account ?? ""}`;
const REPLAY = "wc:welcome-tour";

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not saved: asked again next time.
  }
};

export const replayTour = () => window.dispatchEvent(new Event(REPLAY));

type Stage = "notice" | "tour" | "checking" | "setup" | null;

/** Around the signed-in app: whichever first-visit screen is due, in order, one at a time. */
export function FirstRun({ account, children }: { account: string | null; children: ReactNode }) {
  const [setup, setSetup] = useState<"checking" | "due" | "done">(() => (read(setupKey(account)) ? "done" : "checking"));
  const [notice, setNotice] = useState(() => !read(NOTICE_SEEN));
  const [tour, setTour] = useState(() => !read(TOUR_SEEN));

  useEffect(() => {
    if (setup !== "checking") return;
    let live = true;
    // An account that already has a computer and a ready default agent skips setup on a new browser.
    api.listRuntimes().then(
      (list) => live && setSetup(setupLooksDone(list) ? "done" : "due"),
      () => live && setSetup("done"),
    );
    return () => void (live = false);
  }, [setup]);
  useEffect(() => {
    if (setup === "done") write(setupKey(account), "1");
  }, [setup, account]);
  useEffect(() => {
    const open = () => setTour(true);
    window.addEventListener(REPLAY, open);
    return () => window.removeEventListener(REPLAY, open);
  }, []);

  const stage: Stage = notice ? "notice" : tour ? "tour" : setup === "checking" ? "checking" : setup === "due" ? "setup" : null;
  if (stage === "notice")
    return (
      <UsageNotice
        onContinue={() => {
          write(NOTICE_SEEN, "1");
          setNotice(false);
        }}
      />
    );
  if (stage === "checking") return <Loading />;
  if (stage === "setup") return <SetupPage onDone={() => setSetup("done")} />;
  return (
    <>
      {children}
      {stage === "tour" && (
        <WelcomeTour
          onClose={() => {
            write(TOUR_SEEN, "1");
            setTour(false);
          }}
        />
      )}
    </>
  );
}

// ---- usage notice ------------------------------------------------------------

function useShare(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(() => read(SHARE) !== "0");
  return [
    on,
    (next) => {
      write(SHARE, next ? "1" : "0");
      setOn(next);
    },
  ];
}

function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn("relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full transition-colors nb-focus", on ? "bg-nb-accent" : "bg-nb-ink/20")}
    >
      <span className={cn("inline-block size-3 rounded-full bg-nb-paper shadow-[0_1px_2px_rgba(36,35,31,0.28)] transition-transform", on ? "translate-x-[14px]" : "translate-x-[2px]")} />
    </button>
  );
}

/** Full screen, before the tour. Continue is the only way past. */
function UsageNotice({ onContinue }: { onContinue: () => void }) {
  const c = F.privacy;
  const [share, setShare] = useShare();
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-nb-paper pt-[env(safe-area-inset-top)] font-sans text-nb-ink">
      <div className="flex shrink-0 items-center px-9 pt-4 max-md:px-5">
        <LogoMark />
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-9 py-8 max-md:px-6">
        <div className="w-full max-w-[430px] text-center">
          <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-nb-accent-soft">
            <FiShield size={22} className="text-nb-accent-deep" aria-hidden />
          </span>
          <h1 className="mt-4 text-[24px] font-[850] leading-tight tracking-[-0.02em]">{c.title}</h1>
          <p className="mx-auto mt-2 max-w-[38ch] text-[13px] leading-[19px] text-nb-ink-soft">{c.blurb}</p>
          <div className="nb-panel-sm mt-6 bg-nb-paper p-4 text-left">
            <div className="flex items-center justify-between gap-5">
              <span>
                <span className="block text-[13px] font-[800]">{c.share}</span>
                <span className="mt-1 block text-[11.5px] leading-[16px] text-nb-ink-soft">{c.shareNote}</span>
              </span>
              <Switch on={share} label={c.share} onChange={setShare} />
            </div>
          </div>
          <div className="mt-5 flex items-center justify-between gap-4">
            <a href={PRIVACY_URL} target="_blank" rel="noreferrer" className="text-[12px] font-[750] text-nb-accent-deep underline-offset-2 hover:underline">
              {c.details} →
            </a>
            <Button onClick={onContinue} autoFocus>
              {c.continue}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- welcome tour ------------------------------------------------------------

const WASH = ["bg-nb-accent-wash", "bg-nb-mint-soft", "bg-nb-sky-soft", "bg-nb-lilac-soft", "bg-nb-peach-soft"];
// A deck (legacy #1518): the front card leaves to the left as the one under it rises.
const SLOT = ["none", "translate(7px,6px) rotate(1deg)", "translate(14px,12px) rotate(2deg)"];
const OUT = "translate(-560px,24px) rotate(-6deg)";
const PHONE_PAST = "translateX(-110%) rotate(-4deg)";
const PHONE_NEXT = "scale(.94)";
const EASE = "cubic-bezier(.3,.7,.2,1)";

/** Every way out — Get started, Skip, ✕, Esc — closes it and counts as seen. */
function WelcomeTour({ onClose }: { onClose: () => void }) {
  const c = F.tour;
  const phone = useNarrow();
  const total = c.pages.length;
  const [page, setPage] = useState(0);
  const [noteOpen, setNoteOpen] = useState(false);
  const front = useRef<HTMLDivElement>(null);

  const go = useCallback(
    (to: number) => {
      setPage(Math.max(0, Math.min(total - 1, to)));
      setNoteOpen(false);
    },
    [total],
  );
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(page + 1);
      if (e.key === "ArrowLeft") go(page - 1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [go, page, onClose]);
  useEffect(() => front.current?.querySelector<HTMLElement>("[data-next]")?.focus(), [page]);

  const head = (
    <div className={cn("flex shrink-0 items-center justify-between border-b border-nb-ink/12", phone ? "px-4 py-2" : "px-5 py-3")}>
      <h2 className="min-w-0 truncate text-[15px] font-[800] tracking-[-0.02em]">{c.dialog}</h2>
      <button type="button" aria-label={T.close} onClick={onClose} className={cn("-mr-1 grid cursor-pointer place-items-center rounded-[6px] text-nb-ink-soft hover:bg-nb-ink/5 hover:text-nb-ink", phone ? "size-11" : "size-7")}>
        <FiX className="h-[18px] w-[18px]" />
      </button>
    </div>
  );

  const face = (i: number) => {
    const p = c.pages[i]!;
    const Art = TOUR_ART[i]!;
    const last = i === total - 1;
    return (
      <>
        <div className={cn("flex min-h-0 flex-1", phone && "flex-col overflow-y-auto")}>
          <div className={cn("grid shrink-0 place-items-center overflow-hidden border-nb-ink", WASH[i], phone ? "h-[330px] border-b-[1.5px]" : "w-[420px] max-w-[50%] border-r-[1.5px]")}>
            <div className="max-[400px]:scale-90">
              <Art copy={c} />
            </div>
          </div>
          <div className={cn("flex min-w-0 flex-1 flex-col", phone ? "px-6 py-6" : "overflow-y-auto px-8 py-8")}>
            <p className="text-[13px] leading-[20px] text-nb-ink-soft">{p.pain}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <h3 className="text-[24px] font-[850] leading-[1.2] tracking-[-0.02em]">{p.title}</h3>
              {p.tag && <span className="nb-tag">{p.tag}</span>}
            </div>
            <p className="mt-4 text-[15px] leading-[25px]">{p.value}</p>
            {p.note && (
              <div className="mt-auto pt-6">
                <button type="button" aria-expanded={noteOpen} onClick={() => setNoteOpen((v) => !v)} className="inline-flex cursor-pointer items-center gap-1 text-[12px] font-[700] text-nb-ink-soft hover:text-nb-ink">
                  {noteOpen ? <FiChevronDown aria-hidden /> : <FiChevronRight aria-hidden />}
                  {c.noteLabel}
                </button>
                {noteOpen && <p className="mt-2 rounded-[8px] bg-nb-wash px-3 py-2.5 text-[12px] leading-[19px] text-nb-ink-soft">{p.note}</p>}
              </div>
            )}
          </div>
        </div>
        <div className={cn("flex shrink-0 items-center justify-between gap-3 border-t border-nb-ink/12 px-5 pt-3", phone ? "pb-[max(12px,env(safe-area-inset-bottom))]" : "pb-3")}>
          <button type="button" onClick={onClose} className="cursor-pointer text-[13px] font-[650] text-nb-ink-soft hover:text-nb-ink">
            {c.skip}
          </button>
          <div className="flex items-center gap-1.5">
            {c.pages.map((pg, j) => (
              <button
                key={pg.title}
                type="button"
                aria-label={pg.title}
                aria-current={j === i || undefined}
                onClick={() => go(j)}
                className={cn("h-[8px] cursor-pointer rounded-full border-[1.5px] border-nb-ink transition-[width] duration-200", j === i ? "w-[22px] bg-nb-accent" : "w-[8px] bg-nb-paper")}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {i > 0 && (
              <Button variant="ghost" size="sm" onClick={() => go(i - 1)}>
                {c.back}
              </Button>
            )}
            <Button size="sm" data-next onClick={() => (last ? onClose() : go(i + 1))}>
              {last ? c.done : c.next}
            </Button>
          </div>
        </div>
      </>
    );
  };

  const card = (i: number) => {
    const slot = i - page;
    const transform = phone ? (slot < 0 ? PHONE_PAST : slot > 0 ? PHONE_NEXT : "none") : slot < 0 ? OUT : (SLOT[slot] ?? SLOT[2]);
    const hidden = phone ? Math.abs(slot) > 1 : slot < -1 || slot > 2;
    return (
      <div
        key={i}
        ref={slot === 0 ? front : undefined}
        role={slot === 0 ? "dialog" : undefined}
        aria-modal={slot === 0 || undefined}
        aria-label={slot === 0 ? c.dialog : undefined}
        inert={slot !== 0}
        className={cn("absolute inset-0 flex flex-col overflow-hidden bg-nb-paper", phone ? "shadow-[0_8px_24px_rgba(0,0,0,.18)]" : "nb-panel")}
        style={{
          transform,
          zIndex: total - Math.abs(slot),
          opacity: hidden || (!phone && slot < 0) ? 0 : 1,
          filter: phone && slot > 0 ? "brightness(.9)" : undefined,
          transition: `transform 400ms ${EASE}, opacity 400ms ${EASE}, filter 400ms ${EASE}`,
          pointerEvents: slot === 0 ? undefined : "none",
        }}
      >
        {head}
        <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", !phone && "rounded-b-[14px]")}>{Math.abs(slot) <= 1 && face(i)}</div>
      </div>
    );
  };

  if (phone) return <div className="fixed inset-0 z-50 overflow-hidden bg-nb-paper pt-[env(safe-area-inset-top)] font-sans">{c.pages.map((_, i) => card(i))}</div>;
  return (
    <div className="nb-scrim z-50" style={{ alignItems: "center" }}>
      <div className="relative" style={{ width: 860, maxWidth: "100%", height: 500 }}>
        {c.pages.map((_, i) => card(i))}
      </div>
    </div>
  );
}

// ---- 设置 → 通用 -------------------------------------------------------------

const CAPTION = "text-[11px] font-[700] uppercase leading-[14px] tracking-[0.1em]";

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex min-h-[30px] items-center">
        <h4 className={`${CAPTION} text-nb-ink-soft`}>{title}</h4>
      </div>
      <div className="rounded-[12px] bg-nb-sheet px-4">{children}</div>
    </section>
  );
}

export function GeneralPanel({ onReplay }: { onReplay: () => void }) {
  const [share, setShare] = useShare();
  return (
    <div className="flex flex-col gap-7">
      <Group title={F.tour.dialog}>
        <div className="flex items-center justify-between gap-5 py-3 max-md:flex-col max-md:items-start max-md:gap-2.5">
          <p className="max-w-[56ch] text-[12px] leading-snug text-nb-ink-soft">{F.tour.replay.note}</p>
          <Button variant="ghost" size="sm" className="shrink-0" onClick={onReplay}>
            {F.tour.replay.button}
          </Button>
        </div>
      </Group>
      <Group title={F.general.privacy}>
        <div className="flex items-center justify-between gap-5 py-3">
          <div className="min-w-0">
            <p className="text-[13.5px] font-[700] leading-tight text-nb-ink">{F.privacy.share}</p>
            <p className="mt-1 max-w-[62ch] text-[12px] leading-snug text-nb-ink-soft">{F.privacy.blurb}</p>
          </div>
          <Switch on={share} label={F.privacy.share} onChange={setShare} />
        </div>
      </Group>
    </div>
  );
}
