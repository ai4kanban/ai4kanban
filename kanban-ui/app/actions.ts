"use server";

// Server Actions — this is a local server, so the client calls these directly
// instead of going through HTTP API routes. Reads the board, fires an agent, and
// applies direct edits, all against the markdown files in docs/kanban/.

import { buildPrompt, type AgentRequest } from "@/lib/agent";
import { readBoard } from "@/lib/board";
import { setAutoRefine } from "@/lib/config";
import { ensureDispatcher } from "@/lib/dispatcher";
import { patchCard, type CardPatch } from "@/lib/edit";
import { readModules } from "@/lib/modules";
import { getSession, listSessions, startSession, type StartResult } from "@/lib/registry";
import type { Board, SessionView } from "@/lib/types";

export async function getBoard(): Promise<Board> {
  return readBoard();
}

// The module names from docs/kanban/modules.md, for the create dialog's picker
// (#38). Same shape as getBoard: a server action the client calls directly.
export async function getModules(): Promise<string[]> {
  return readModules();
}

const ACTIONS = new Set(["implement", "reject", "archive", "edit", "create", "refine", "resolve", "propose"]);

// create and propose touch no existing card (create makes one, propose makes
// three), so they carry no `id` — every other action needs one.
const CARDLESS = new Set(["create", "propose"]);

// Start an agent and return immediately with a sessionId (or a lock message). The
// request never waits for the child — the client polls listSessionsAction() to
// see the session's progress and outcome.
export async function startAgentAction(req: AgentRequest): Promise<StartResult> {
  if (!req || !ACTIONS.has(req.action)) throw new Error("unknown action");
  if (!CARDLESS.has(req.action) && !Number.isInteger(req.id)) {
    throw new Error("action needs a card id");
  }
  const prompt = buildPrompt(req);
  return startSession(req, prompt);
}

// The shared session registry, for the UI's poll. Every tab reads the same picture.
// The UI polls this continuously, so it's also where we make sure the background
// auto-refine dispatcher (#43) is running — idempotent, so a poll from any tab
// keeps it alive for the life of the UI server.
export async function listSessionsAction(): Promise<SessionView[]> {
  ensureDispatcher();
  return listSessions();
}

// One session with its log tail, read from the log file. The UI polls this while
// a session is live to tail its output, and calls it once to open a finished
// session's log.
export async function getSessionAction(sessionId: string): Promise<SessionView | null> {
  if (typeof sessionId !== "string" || !sessionId) return null;
  return getSession(sessionId);
}

export async function patchCardAction(
  id: number,
  patch: CardPatch,
): Promise<{ ok: boolean; error?: string }> {
  return patchCard(id, patch);
}

// Flip the global auto-refine switch (#41), persisted to docs/kanban/ui.config.json.
// Returns { ok:false, error } on a parse/write failure so the toggle can revert
// and surface the message; keeps the agent `command` untouched.
export async function setAutoRefineAction(on: boolean): Promise<{ ok: boolean; error?: string }> {
  return setAutoRefine(Boolean(on));
}
