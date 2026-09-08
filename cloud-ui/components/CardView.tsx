"use client";

// One card, in a browser (#322, #364) — the hosted half of what `CardWindow` is in the app.
//
// The card reads whole: the human half, the folded agent half, its subtasks and its open
// questions, exactly as the board itself shows it. What it can DO is the card's two decisions
// and no more — approve a delivery for review, and answer the questions the user owns — so the
// surface names those two controls and the page draws no others.
//
// A card the board is raising no decision for draws none of them: the panel stays a read and
// the toolbar is gone, rather than offering a press that would go nowhere.

import { useRouter } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import { BoardBaseProvider } from "@/components/board-links";
import { CardPage, type CardChrome } from "@/components/CardPage";
import { CardEventsProvider, useCardEvent } from "@/lib/card-event";
import type { CardScreen } from "@/lib/format/board/screen";
import type { NotificationRow } from "@/lib/notifications";
import { ScreenActionsProvider, ScreenControlsProvider } from "@/lib/screen";
import { HOSTED_CONTROLS, hostedActions } from "../lib/actions";
import type { HostedCopy } from "../lib/copy";
import { CopyProvider, OpenInApp, TopRow } from "./Frame";

function Shell({ children, ...chrome }: CardChrome & { children: ReactNode }) {
  const workspace = chrome.screen.id;
  const card = chrome.screen.card.id;
  // Read from inside the providers below, so the row and the page agree about whether this
  // card is waiting on a decision — a page that offers two buttons must not also call itself
  // read-only.
  const decision = useCardEvent(card);
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <TopRow
        workspaceName={chrome.screen.standing.workspaceName}
        back={`/${workspace}`}
        readOnly={!decision}
      >
        <OpenInApp workspace={workspace} card={card} />
      </TopRow>
      {children}
    </div>
  );
}

export function CardView({
  screen,
  copy,
  /** This card's live decision, as the workspace holds it — or null when it is raising none.
   *  One row, not the workspace's whole list: a card page asks about one card. */
  event,
  /** The app link this page offers, for a machine that holds a copy of this workspace. */
  workspace,
}: {
  screen: CardScreen;
  copy: HostedCopy;
  event: NotificationRow | null;
  workspace: string;
}) {
  const router = useRouter();
  const rows = useMemo(() => (event ? [event] : []), [event]);
  const actions = useMemo(
    () =>
      hostedActions({
        eventId: event?.eventId ?? null,
        endpoint: `/${encodeURIComponent(workspace)}/${screen.card.id}/decide`,
        unavailable: copy.pressUnavailable,
        refused: copy.pressRefused,
        onPressed: () => router.refresh(),
      }),
    [event?.eventId, workspace, screen.card.id, copy, router],
  );

  return (
    <CopyProvider value={copy}>
      {/* The card's own links — its group root, its blockers, its subtasks and the `#12`s
          in its body — lead to cards under this same workspace. */}
      <BoardBaseProvider value={`/${screen.id}`}>
        <CardEventsProvider value={rows}>
          {/* A card with no live decision is handed no writer at all, so every control on the
              page is gone rather than dead — the same read-only page #322 drew. */}
          <ScreenActionsProvider value={event ? actions : null}>
            <ScreenControlsProvider value={HOSTED_CONTROLS}>
              <CardPage screen={screen} shell={Shell} />
            </ScreenControlsProvider>
          </ScreenActionsProvider>
        </CardEventsProvider>
      </BoardBaseProvider>
    </CopyProvider>
  );
}
