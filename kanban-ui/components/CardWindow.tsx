"use client";

// A card, in this app's own window (#374) — the card page's half of what BoardWindow does
// for the board. `CardPage` is the screen; this is the window, the top row and the one band
// that leads somewhere only this machine has.

import type { ReactNode } from "react";
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
  const { card, openIds, memoryModules, goalWritten } = screen;
  return (
    <Window
      projectRoot={machine.projectRoot}
      openIds={openIds}
      currentId={card.id}
      currentTitle={card.title}
      memoryModules={memoryModules}
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
      {children}
    </Window>
  );
}

/** The same line the board draws (#175) — a newer app in the app, a pointer to the app in a
 *  browser. */
function CardStrips({ at }: CardChrome & { at: StripPlace }) {
  const machine = useMachine()!;
  return at === "head" ? <RunningNotice desktop={machine.desktop} /> : null;
}
