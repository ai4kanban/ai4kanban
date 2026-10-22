"use client";

// The New idea action (#1081), self-contained so the shared Header can show it on every page.
// The button opens the create sheet (#426);
// starting a session pops the header's global sessions panel open on that new
// session so the agent is visibly working (a create takes a while — a silent
// button reads as "nothing happened"). When the session finishes it re-opens the
// panel on that session (so its result/errors are never lost) and re-reads the
// server component so the new card shows up on the board.
//
// A create touches no card, so it has no card page of its own — the sessions
// panel is its only home for the log. That log entry point (the archive icon, the
// badge, a past session's tail) now lives in the shared Sessions component; this
// component just starts the session and hands it to the panel.
//
// The sheet only discusses (#840); the plan handoff's two answers are what start a run. The
// sheet stays up until that run is going (#706), and a refusal goes back into it under the
// answers. It only reaches this button when the reader is no longer there to read it — at
// phone width, where there is no rail row to mark instead.

import { useRouter } from "next/navigation";
import {
  startDiscussionAction,
  startPlanBuildAction,
  startPlanningAction,
  type PlanPick,
} from "@/app/actions";
import { useCallback, useEffect, useRef, useState } from "react";
import { LuLightbulb } from "react-icons/lu";
import { useCopy } from "@/i18n/use-copy";
import {
  createSheet,
  heldByButton,
  useArchivedDiscussion,
  useButtonError,
  useCloseSheetRequest,
  discussionTriage,
  useCreateSheetRequest,
  useStarting,
} from "@/lib/create-open";
import { failureText, startFailure, type StartFailure } from "@/lib/start-failure";
import { appendDraft, createDraftKey, dropDraft } from "@/lib/draft";
import { dropPictures } from "@/lib/picture-box";
import { LESS_MOTION, useLeaving, useMatches, usePhone } from "@/lib/media";
import { newCards } from "@/lib/new-cards";
import { poll } from "@/lib/poll";
import type { DiscussRead, DiscussionTarget, SessionView } from "@/lib/types";
import type { StartResult } from "@/lib/registry";
import type { PlanAnswer } from "@/lib/format/agent/types";
import { Button } from "./button";
import { useChatRailHere } from "./Chat";
import { CreateSheet } from "./CreateSheet";
import { sessionsPanel, useAgentSessions } from "./sessions";

// A discussion as a key, and the one conversation of a board whose rules predate the list as
// the empty string — no `DiscussionTarget` is that, so the two never collide.
const askedOn = (discussion: DiscussionTarget | null): string => discussion ?? "";

// The same as `starting`, readable in the same tick: the answers go down on the next render,
// and two clicks inside one would otherwise both find nothing started and ask for two runs.
const asking = new Set<string>();

/** A press on a control, not on the space between them — the title bar's empty stretch is
 *  what the window is dragged by. */
const PRESSABLE = "a[href], button, select, summary, [role=button], [role=link], [role=tab], [role=menuitem], [role=option]";

/** Throw away what one discussion was holding unsent — it is over. */
function forget(discussion: DiscussionTarget | null) {
  if (heldByButton.unspoken === discussion) heldByButton.unspoken = null;
  if (discussion) discussionTriage.delete(discussion);
  dropDraft(createDraftKey(discussion));
  dropPictures(askedOn(discussion));
}

export function CreateTask({
  projectRoot,
}: {
  /** Which board this is — the sheet's Discuss reads the board's own conversation, which on
   *  a card's page is not the one the window is holding. */
  projectRoot: string;
}) {
  const copy = useCopy();
  const c = copy.board.create;
  const plan = c.sheet.plan;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // The discussion the sheet is holding (#496). A press opens a fresh one; a rail row hands
  // over the one it is picking back up. Null while the board's rules are older than the list,
  // which still holds its one conversation. Picked up from the last page's button (#888).
  const [discussion, setDiscussion] = useState<DiscussionTarget | null>(() => heldByButton.discussion);
  useEffect(() => {
    heldByButton.discussion = discussion;
  }, [discussion]);
  // A plan answer whose run was refused after the reader closed the window, at phone width
  // where there is no rail row to mark (#706).
  const error = useButtonError();
  const setError = createSheet.buttonError;
  // The plan answer being asked for, keyed by the discussion it was pressed on (#706). Keyed
  // rather than single because the reader may pick another discussion up while the request is
  // out: only the one that pressed goes down, and the one picked up is live and startable.
  const starting = useStarting();
  // Why the last start on the discussion the sheet is holding never came up, by the plan it
  // was pressed on — "" is the pair under every plan (#1442). It lives here rather than in the
  // sheet so an answer pressed on one discussion cannot say it on another.
  const [failures, setFailures] = useState<Record<string, StartFailure>>({});
  // The discussion whose Start now went through Plan tasks instead.
  const [rerouted, setRerouted] = useState<string | null>(null);

  // The discussion this screen is holding, readable after an await — a rail row may have
  // handed over another one while a run was starting (#610).
  const held = useRef(discussion);
  useEffect(() => {
    held.current = discussion;
  }, [discussion]);
  // And whether the window is still up at all — Esc and the close button answer while a start
  // is in flight (#706), and a refusal has nowhere to land once they have.
  const openHere = useRef(open);
  useEffect(() => {
    openHere.current = open;
  }, [open]);
  // A page change takes this button down with the window.
  useEffect(
    () => () => {
      openHere.current = false;
    },
    [],
  );

  // The discussion is over: back to a fresh Create task, and what it was holding unsent goes
  // with it, or the next press opens on a subject that is finished.
  const freshen = useCallback(() => {
    forget(held.current);
    setOpen(false);
    setDiscussion(null);
    setError(null);
    setFailures({});
  }, [setError]);

  // Going anywhere else closes the sheet and keeps the discussion (#888): a press on the
  // rail, the top row, the bell or the phone's tabs, or the window taking the reader to a card.
  const closeAsked = useCloseSheetRequest();
  const seenClose = useRef(closeAsked);
  useEffect(() => {
    if (closeAsked === seenClose.current) return;
    seenClose.current = closeAsked;
    setOpen(false);
  }, [closeAsked]);
  useEffect(() => {
    if (!open) return;
    const leave = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent && e.key !== "Enter" && e.key !== " ") return;
      if (e instanceof PointerEvent && e.button !== 0) return;
      const at = e.target instanceof Element ? e.target : null;
      if (at?.closest("[data-leaves-sheet]") && at.closest(PRESSABLE)) setOpen(false);
    };
    window.addEventListener("pointerdown", leave, true);
    window.addEventListener("keydown", leave, true);
    return () => {
      window.removeEventListener("pointerdown", leave, true);
      window.removeEventListener("keydown", leave, true);
    };
  }, [open]);

  // The rail and this screen are never both up: opening either folds the other, the way the
  // chat rail and the bell already treat each other (components/Window.tsx).
  const rail = useChatRailHere();
  const railOpen = rail?.open === true;
  const foldRail = rail?.fold;
  useEffect(() => {
    if (railOpen) setOpen(false);
  }, [railOpen]);
  // Only a rail on screen: off a card's pages it is hidden, and its remembered state stays.
  const railOpenRef = useRef(railOpen);
  railOpenRef.current = railOpen;
  useEffect(() => {
    if (open && railOpenRef.current) foldRail?.();
  }, [open, foldRail]);

  // Every press is a new subject (#496): the sheet opens on a discussion of its own, so a
  // second idea is never typed into the first. Nothing is written until the first message,
  // so a sheet opened and closed again leaves no row in the rail.
  //
  // At phone width there is no rail to list them, so the press stays on the discussion it
  // already had — one is reachable there, and a new one every press would be a subject with
  // no way back to it. And a fresh one nothing was sent into is still the fresh one (#934):
  // it has no row either, so a new one would lose what was typed into it.
  const phone = usePhone();
  // A closed sheet plays its way out before it goes (#1948).
  const sheet = useLeaving(open, useMatches(LESS_MOTION) ? 0 : 150);
  // What it leaves on — closing can let go of the discussion in the same move (freshen).
  const [leftOn, setLeftOn] = useState(discussion);
  if (open && leftOn !== discussion) setLeftOn(discussion);
  const sheetOn = open ? discussion : leftOn;
  // Words handed over with the ask (#1193) always go to a fresh one, after its draft.
  const openFresh = useCallback(async (prefill?: string, triage?: string) => {
    setError(null);
    setFailures({});
    if (phone && discussion && !prefill) return setOpen(true);
    // Opened after the discussion is in hand, so the sheet never paints a frame of the last
    // subject's exchange on its way to the new one.
    // Null is a board whose rules are older than the list. It holds one conversation, which
    // is exactly what `null` reads as.
    const fresh = heldByButton.unspoken ?? (await startDiscussionAction());
    heldByButton.unspoken = fresh;
    if (prefill) appendDraft(createDraftKey(fresh), prefill);
    if (fresh && triage) discussionTriage.set(fresh, triage);
    setDiscussion(fresh);
    setOpen(true);
  }, [phone, discussion, setError]);

  // The empty board asks for the sheet from the middle of the page (#437), and a rail row
  // picks a discussion back up the same way (#496) — the first card is offered where the
  // reader is looking, not by pointing at this button. Only an ask made while this row was on
  // screen: the store outlives a page change, and a sheet opening by itself on the page
  // someone navigated to is a box nobody pressed for.
  // Archived from the rail (#610). Only the one this screen is holding: archiving another
  // discussion, or this one after the reader has already moved to a different subject, leaves
  // the screen where it is.
  const dropped = useArchivedDiscussion();
  const seenDropped = useRef(dropped);
  useEffect(() => {
    if (!dropped || dropped === seenDropped.current) return;
    seenDropped.current = dropped;
    if (dropped.discussion === held.current) freshen();
    else forget(dropped.discussion);
  }, [dropped, freshen]);

  // What is on screen, for the rail's mark (#722): the sheet covers the page under it, so
  // the discussion it is holding is where the reader is, and the row below is the one to
  // mark.
  useEffect(() => {
    createSheet.up(open);
    return () => createSheet.up(false);
  }, [open]);
  const showing = open ? discussion : null;
  useEffect(() => {
    createSheet.showing(showing);
    return () => createSheet.showing(null);
  }, [showing]);

  const asked = useCreateSheetRequest();
  const seen = useRef(asked);
  useEffect(() => {
    if (!asked || asked === seen.current) return;
    seen.current = asked;
    setError(null);
    setFailures({});
    // A row named the discussion it is picking back up; the empty board's ask names none, so
    // it opens a fresh one exactly as the button does.
    if (asked.discussion) {
      // Opening it is reading it, so the rail's mark on that row has done its job (#706).
      createSheet.startCleared(asked.discussion);
      setDiscussion(asked.discussion);
      setOpen(true);
    } else {
      void openFresh(asked.prefill, asked.triage);
    }
  }, [asked, openFresh, setError]);

  // A session this tab started finished — re-open the sessions panel on it so the
  // result/errors are never lost, and re-read the server component so the new card shows up
  // (on the board; harmless on a card page).
  // Plan tasks keeps the discussion up and lists the cards in it (#1213), so its run
  // never opens the panel.
  const quiet = useRef(new Set<string>());
  // The discussion each run was started from: what it wrote is marked new on the board (#1954).
  const startedOn = useRef(new Map<string, DiscussionTarget | null>());
  const onFinish = useCallback(
    (session: SessionView) => {
      if (!quiet.current.has(session.sessionId)) sessionsPanel.open(session.sessionId);
      router.refresh();
      if (!startedOn.current.has(session.sessionId)) return;
      const on = startedOn.current.get(session.sessionId) ?? null;
      startedOn.current.delete(session.sessionId);
      if (session.cardId !== null) newCards.add(projectRoot, [session.cardId]);
      void poll<DiscussRead>(on === null ? "/poll/discuss" : `/poll/discuss?discussion=${encodeURIComponent(on)}`)
        .then((read) => {
          const ids = [...(read.became ?? []), ...(read.rows ?? []).flatMap((r) => r.cards ?? [])].map((b) => b.id);
          if (ids.length) newCards.add(projectRoot, ids);
        })
        .catch(() => {});
    },
    [router, projectRoot],
  );

  const { watch } = useAgentSessions(onFinish);

  // The two answers under the plan handoff that start a run (#427, #481), for one plan or
  // every one still waiting (#1442). The screen stays up until a run is actually going (#706):
  // a start can be refused, and closing first left the reader with no way to press again.
  // Only the paths and their workflows are sent; the server checks them against the
  // discussion.
  //
  // Everything after the await is about the discussion the answer was PRESSED on, which may no
  // longer be the one on screen: the outcome goes wherever that discussion still is — this
  // window, its row in the rail, or, at phone width, under the button.
  const startFromPlan = useCallback(
    async (answer: PlanAnswer, picks: PlanPick[], all: boolean, ends: boolean) => {
      const on = discussion;
      const key = askedOn(on);
      if (asking.has(key)) return;
      asking.add(key);
      createSheet.starting(key, { answer, paths: all ? null : picks.map((p) => p.path) });
      setFailures({});
      setRerouted(null);
      createSheet.startCleared(on);
      const said = answer === "build" ? plan.build : plan.start;
      const runs: { path: string | null; res: StartResult }[] = [];
      if (answer === "build") {
        const res = await startPlanBuildAction(on, said, undefined, picks);
        runs.push(...(res.each ?? [{ path: null, result: res }]).map((e) => ({ path: e.path, res: e.result })));
      }
      // A connector that can't take the discussion into the build plans it instead (#1246).
      if (answer === "build" && runs.some((r) => r.res.reason === "chatNoFork")) {
        answer = "plan";
        setRerouted(key);
        runs.length = 0;
      }
      if (answer === "plan") {
        runs.push({ path: null, res: await startPlanningAction(on, said, undefined, picks) });
      }
      asking.delete(key);
      createSheet.starting(key, null);
      // A run needs an id to be watched and tailed, so a yes with none is a start that did not
      // happen.
      const went = runs.filter((r) => r.res.ok && r.res.sessionId);
      const refused = runs.filter((r) => !r.res.ok || !r.res.sessionId);
      for (const r of went) {
        const id = r.res.sessionId!;
        // Plan tasks keeps the discussion up, shut, while its cards are written (#1213), and so
        // does any handoff that leaves a plan still waiting (#1442).
        if (answer === "plan" || !ends) quiet.current.add(id);
        startedOn.current.set(id, on);
        watch(id, answer === "plan" ? "Plan tasks" : "Start now");
      }
      if (went.length && answer === "build" && ends && !refused.length) {
        // The last plan is handed over, which is where the board archives the discussion
        // (#551) — so the screen lets go of it too (#610), unless another one is up now.
        if (held.current === on) freshen();
        else forget(on);
        sessionsPanel.open(went[0]!.res.sessionId!);
        return;
      }
      if (went.length && held.current !== on && answer === "plan" && ends) forget(on);
      if (!refused.length) return;
      // Said under the row it was pressed on, or under the pair for a press on every plan.
      const whys = refused.map((r) => ({
        at: all && (answer === "plan" || r.path === null) ? "" : (r.path ?? picks[0]?.path ?? ""),
        why: startFailure(r.res, plan.failed),
      }));
      if (openHere.current && held.current === on) {
        return setFailures(Object.fromEntries(whys.map((w) => [w.at, w.why])));
      }
      // Gone elsewhere. A discussion has a row to mark; at phone width it has none, and the
      // button is the only thing left on screen to say it on.
      if (on && !phone) createSheet.startFailed(on, failureText(whys[0]!.why));
      else setError(failureText(whys[0]!.why));
    },
    [discussion, watch, freshen, phone, plan, setError],
  );

  // Cards written while the sheet is up (#1954): the discussion is over, and the reader stays
  // where they are, with the cards marked on the board.
  const becameCards = useCallback(
    (cardIds: number[]) => {
      newCards.add(projectRoot, cardIds);
      freshen();
    },
    [freshen, projectRoot],
  );

  // `N` from anywhere that isn't taking text, as the rail's `/` (#1964).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "n" || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      const at = e.target as HTMLElement | null;
      if (at?.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']")) return;
      if (open || document.querySelector("[data-a4k-overlay], [role=dialog]")) return;
      e.preventDefault();
      void openFresh();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, openFresh]);

  // The top row's 28px box, 36px at phone width where a thumb has to hit it (#357).
  const label = c.button;
  const tip = copy.chrome.header.newIdea;
  return (
    <div className="relative flex shrink-0 items-center">
      <Button
        size="xs"
        className="nb-tip nb-tip-below nb-tip-end shrink-0 max-md:h-9"
        aria-keyshortcuts="N"
        data-tip={tip}
        onClick={() => void openFresh()}
      >
        <LuLightbulb className="text-[15px]" aria-hidden />
        <span>{label}</span>
        <kbd
          className="ml-0.5 hidden h-[17px] min-w-[17px] items-center justify-center rounded-[5px] bg-white/20 px-1 font-sans text-[10.5px] font-[800] leading-none md:inline-flex"
          aria-hidden
        >
          N
        </kbd>
      </Button>

      {error && (
        <div
          // Wide enough for short lines rather than a tall column (#544), and clamped to the
          // viewport so it stays on screen. `pre-line` keeps the paths the board listed under
          // the sentence on their own lines; `break-words` keeps a long one inside the panel.
          className="nb-panel-sm absolute right-0 top-full z-30 mt-2 w-[min(420px,calc(100vw-32px))] cursor-pointer whitespace-pre-line break-words p-3 text-[12px] leading-relaxed"
          style={{ background: "var(--color-nb-peach-soft)" }}
          onClick={() => setError(null)}
        >
          {error}
        </div>
      )}

      {sheet.drawn && (
        <CreateSheet
          key={askedOn(sheetOn)}
          leaving={sheet.leaving}
          projectRoot={projectRoot}
          discussion={sheetOn}
          onClose={() => setOpen(false)}
          onSent={() => {
            if (heldByButton.unspoken === sheetOn) heldByButton.unspoken = null;
          }}
          starting={starting[askedOn(sheetOn)] ?? null}
          failures={failures}
          rerouted={rerouted === askedOn(sheetOn)}
          onHandoff={(answer, picks, all, ends) => void startFromPlan(answer, picks, all, ends)}
          onBecame={becameCards}
        />
      )}
    </div>
  );
}
