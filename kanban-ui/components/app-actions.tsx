"use client";

// The app's own ScreenActions (#374) — the board screens' one door onto this machine.
//
// It is assembled here, on the client side of the boundary, because a server component may
// hand a client component only serializable props and Server Action references: an object of
// actions cannot come down from a page. Every entry is a straight pass to the server action
// of the same name; nothing is decided here.
//
// This is the only module the board screen and the card page reach `@/app/actions` through.
// A caller that is not this app builds its own object of the same shape — or none, and the
// same screens render read-only.
//
// `AppActions` puts it in front of every screen the app serves, from the root layout: the
// runs panel in the top row reads it too, and that row is on the memory, archive and mockup
// pages as well as on the board.

import {
  approveDeliveryAction,
  cancelCloudRequestAction,
  cardOnBoardAction,
  closeReleaseAction,
  createReleaseAction,
  discardDeliveryAction,
  dropReleaseAction,
  dropVerifyAction,
  getBoard,
  getSessionAction,
  listSessionsAction,
  patchCardAction,
  planReleaseAction,
  readDraftsAction,
  repurposeChannelAction,
  resumeCloudRequestAction,
  resumeSessionAction,
  saveDraftAction,
  scheduleCardAction,
  setCardsReleaseAction,
  setChannelStatusAction,
  setReleaseGoalAction,
  startAgentAction,
  stopSessionAction,
  unscheduleCardAction,
} from "@/app/actions";
import { ScreenActionsProvider, type ScreenActions } from "@/lib/screen";

export const appActions: ScreenActions = {
  readBoard: getBoard,
  cardOnBoard: cardOnBoardAction,

  patchCard: patchCardAction,
  dropVerify: dropVerifyAction,
  scheduleCard: scheduleCardAction,
  unscheduleCard: unscheduleCardAction,

  setCardsRelease: setCardsReleaseAction,
  createRelease: createReleaseAction,
  planRelease: planReleaseAction,
  dropRelease: dropReleaseAction,
  closeRelease: closeReleaseAction,
  setReleaseGoal: setReleaseGoalAction,

  listSessions: listSessionsAction,
  getSession: getSessionAction,
  startAgent: startAgentAction,
  stopSession: stopSessionAction,
  resumeSession: resumeSessionAction,

  approveDelivery: approveDeliveryAction,
  discardDelivery: discardDeliveryAction,

  resumeCloudRequest: resumeCloudRequestAction,
  cancelCloudRequest: cancelCloudRequestAction,

  readDrafts: readDraftsAction,
  saveDraft: saveDraftAction,
  repurpose: repurposeChannelAction,
  setChannelStatus: setChannelStatusAction,
};

export function AppActions({ children }: { children: React.ReactNode }) {
  return <ScreenActionsProvider value={appActions}>{children}</ScreenActionsProvider>;
}
