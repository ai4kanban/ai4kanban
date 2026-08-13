import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { repoRoot } from "./paths";
import type {
  AgentInfo,
  AgentRequest,
  ConnectionTest,
  HarnessSetting,
  RunRecord,
  RunView,
} from "./format/agent/types";
import type {
  Board,
  BulkReleaseResult,
  Card,
  CardPatch,
  ClosePlan,
  DropPlan,
  FillPlan,
  MetricsResult,
  SaveProjectResult,
  SetupDraft,
  SetupState,
  TrackDraft,
  WriteResult,
} from "./format/view/types";

// --- the board's rules, loaded once (#168, #169) -----------------------------
// Everything the board is — how a card is written, what a release does when it closes, how
// the setup checklist reads, which cards a refine would move, which agent runs and what it
// is sent — lives in the CLI, as one built file. This loads that file and hands the UI its
// exports. The UI keeps no copy of any of it.
//
// Loading it rather than shelling out to it is the same one copy of the rules either way:
// it IS `akb`'s own module, and a card written here is a card written there. What it buys
// is that the board's poll doesn't spawn a process every second and a half.
//
// Where the file is:
//   • `AI4KANBAN_CLI` names it outright — the desktop app passes the copy it carries, so
//     an app on a machine with nothing installed still runs the board.
//   • otherwise the skill folder in this repo, either harness's.
//
// A repo with no copy at all has nothing to read the board with, and every screen says so
// in one line that names the fix rather than coming up empty.

/** What the built file gives us. It is the CLI's own public surface — see the exports at
 *  the top of `cli/src/kanban.ts`. */
export interface BoardRules {
  setBoardRoot(root: string): string;

  // the runs
  listRuns(): RunView[];
  getRun(id: string, bytes?: number): RunView | null;
  openRun(req: AgentRequest, prompt: string): { run: RunRecord } | { error: string };
  openResume(id: string): { run: RunRecord } | { error: string };
  markSpawned(sessionId: string, pid: number | undefined): void;
  spawnWatcher(sessionId: string): number | undefined;
  stopRun(id: string): { ok: boolean; sessionId?: string; error?: string };
  titleOf(cardId: number | undefined): string | undefined;
  buildPrompt(req: AgentRequest): string;

  // the agent, and what it is set to
  agentInfo(): AgentInfo;
  activeSettings(): HarnessSetting[];
  settingSaveError(key: string, value: string): string | null;
  setupInstruction(): string;
  setHarness(name: string): WriteResult;
  setHarnessSetting(key: string, value: string): WriteResult;
  setSecret(name: string, value: string): WriteResult;
  testConnection(): Promise<ConnectionTest>;

  // the board, read
  readBoard(): Board;
  findCard(id: number): Card | null;
  allCards(): Card[];
  readModules(): string[];
  readMetricsView(): MetricsResult;
  readReleases(): string[];
  readGoalText(): string;
  readSetupDraft(): SetupDraft;
  readSetupState(): SetupState | null;
  fillPlan(): FillPlan;
  closePlan(id: string): ClosePlan;
  dropPlan(id: string): DropPlan;

  // the board, written
  patchCard(id: number, patch: CardPatch): WriteResult;
  setCardsRelease(ids: number[], release: string): BulkReleaseResult;
  newRelease(id: string, goal?: string, fill?: boolean): WriteResult & { fill?: "none" | "fill" | "agent" };
  setReleaseGoal(id: string, goal: string): WriteResult;
  closeRelease(id: string): WriteResult;
  dropRelease(id: string): WriteResult;
  saveGoal(text: string): WriteResult;
  saveProject(name: string, description: string, tracks: TrackDraft[]): SaveProjectResult;
  finishSetupStep(name: string): WriteResult;

  // what the board would start on its own, this minute
  nextWork(): AgentRequest[];
}

export type { AgentRequest, RunRecord, RunView } from "./format/agent/types";

/** The one line every screen shows when there is no usable copy of the board's rules —
 *  none installed, or one too old to read the board. It names the fix, because the fix is
 *  one command. */
export class NoRulesError extends Error {
  constructor(what: string) {
    super(`${what} Run \`npx ai4kanban@latest update\` in this project to install one.`);
    this.name = "NoRulesError";
  }
}

// One load per server process, pinned to globalThis: Next may evaluate this module more
// than once across its server bundles, and two loads would be two module states — two
// board roots, and two of everything the rules keep.
function cached(): { rules?: Promise<BoardRules> } {
  const g = globalThis as unknown as { __kanbanRules?: { rules?: Promise<BoardRules> } };
  if (!g.__kanbanRules) g.__kanbanRules = {};
  return g.__kanbanRules;
}

function candidates(): string[] {
  const named = process.env.AI4KANBAN_CLI;
  if (named) return [named];
  let root: string;
  try {
    root = repoRoot();
  } catch {
    return [];
  }
  return [
    path.join(root, ".claude", "skills", "kanban", "kanban.mjs"),
    path.join(root, ".agents", "skills", "kanban", "kanban.mjs"),
  ];
}

// The newest thing the UI asks of the rules. A copy that predates it is a copy that cannot
// draw the board at all, so it is turned away by name here rather than failing later as an
// undefined function somewhere in a render.
const REQUIRED = ["listRuns", "readBoard", "nextWork"] as const;

/** The board's rules, loaded and pointed at this server's board. */
export function boardRules(): Promise<BoardRules> {
  const box = cached();
  if (box.rules) return box.rules;
  const looked = candidates();
  const found = looked.find((file) => fs.existsSync(file));
  if (!found) {
    return Promise.reject(
      new NoRulesError(
        `This board has no copy of the board's rules to read it with — looked at ${looked.join(", ") || "nowhere: there is no board here"}.`,
      ),
    );
  }
  box.rules = import(/* webpackIgnore: true */ pathToFileURL(found).href).then(
    (mod: Partial<BoardRules>) => {
      const missing = REQUIRED.filter((name) => typeof mod[name] !== "function");
      if (missing.length > 0) {
        throw new NoRulesError(`The board's rules at ${found} are too old for this board.`);
      }
      // Every command points the rules at one board before it runs; here it is one board
      // for the life of the server, so it is set once.
      mod.setBoardRoot?.(repoRoot());
      return mod as BoardRules;
    },
  );
  // A failed load must not be remembered as the answer: install the rules and the next
  // click should work without restarting the board.
  box.rules.catch(() => {
    box.rules = undefined;
  });
  return box.rules;
}

/** What went wrong, in one line a strip can show. */
export function whyNoRules(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
