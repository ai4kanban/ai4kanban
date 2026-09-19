"use client";

// A card, in this app's own window (#374) — the card page's half of what BoardWindow does
// for the board. `CardPage` is the screen; this is the window, the top row and the one band
// that leads somewhere only this machine has.

import { useEffect, useState, type ReactNode } from "react";
import { cardOpen } from "@/lib/card-open";
import { ScreenMachineProvider, useMachine, type ScreenMachine, type StripPlace } from "@/lib/screen";
import type { CardScreen } from "@/lib/types";
import { CardPage, type CardChrome } from "./CardPage";
import { RunningNotice } from "./desktop";
import { Header } from "./Header";
import { Window } from "./Window";

export function CardWindow({ screen, machine }: { screen: CardScreen; machine: ScreenMachine }) {
  return (
    <ScreenMachineProvider value={machine}>
      <CardPage screen={screen} shell={CardShell} strips={CardStrips} />
    </ScreenMachineProvider>
  );
}

/** Landing on a card is what opens it in the window's rail — every way in is that page, so a
 *  board card, a subtask, a `#12` in a body and a pasted link all leave the same row behind,
 *  which is also the way back out. */
function CardShell({ screen, running, onBoardChanged, onError, children }: CardChrome & { children: ReactNode }) {
  const machine = useMachine()!;
  const { card, openIds, memoryOwners, goalWritten } = screen;
  // What the next card's opening screen draws before its card is read (#906).
  useEffect(() => {
    cardOpen.rememberFrame({ projectRoot: machine.projectRoot, openIds, memoryOwners, goalWritten, agent: machine.agent, desktop: machine.desktop });
    cardOpen.rememberTitle(card.id, card.title);
    for (const s of card.subtasks ?? []) cardOpen.rememberTitle(s.id, s.title);
  }, [machine, openIds, memoryOwners, goalWritten, card]);
  // Faded in over a skeleton that was seen; a quick read just appears.
  const [reveal] = useState(cardOpen.skeletonSeen);
  useEffect(() => cardOpen.setSkeleton(false), []);
  return (
    <Window
      projectRoot={machine.projectRoot}
      openIds={openIds}
      currentId={card.id}
      currentTitle={card.title}
      memoryOwners={memoryOwners}
      goalWritten={goalWritten}
      running={running}
      onBoardChanged={onBoardChanged}
      header={
        <Header
          agent={machine.agent}
          projectRoot={machine.projectRoot}
          onError={onError}
          goalWritten={goalWritten}
          desktop={machine.desktop}
        />
      }
    >
      <div className={reveal ? "a4k-reveal h-full" : "h-full"}>{children}</div>
    </Window>
  );
}

/** The same line the board draws (#175) — a newer app in the app, a pointer to the app in a
 *  browser. */
function CardStrips({ at }: CardChrome & { at: StripPlace }) {
  const machine = useMachine()!;
  return at === "head" ? <RunningNotice desktop={machine.desktop} /> : null;
}
