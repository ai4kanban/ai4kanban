// Cloud, from the MAIN process (#317).
//
// Onboarding offers a Cloud board before any board is open, so there is no board server to
// ask — the launcher is a `data:` page and this process is what answers it. It reaches Cloud
// exactly the way `lib/rules.ts` reaches the language setting: by loading the bundled rules,
// `resources/cli/dist/kanban.mjs`, which is the same module every board server runs the
// board through.
//
// Nothing here is a second implementation of anything. The sign-in, the workspace calls, the
// import and the pointer are all the CLI's; this file is the shape of them the launcher can
// ask for over the bridge.

import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { bundledResource } from "./resources";
import type {
  CloudAccountView,
  CloudFolder,
  CloudGoRequest,
  CloudGoResult,
  CloudMoveResult,
  CloudWorkspaceView,
} from "../shared/bridge";

/** The little of the rules' surface this process asks for. Every entry is optional: a build
 *  whose bundled rules predate Cloud offers the Local moves and says the rest is unavailable,
 *  rather than failing to draw a launcher. */
interface CloudRules {
  setBoardRoot?(root: string): string;
  readCloudAccount?(): Promise<{
    state: string;
    handle: string | null;
    name: string | null;
    message: string | null;
    inviteRequestedAt: string | null;
    configured: boolean;
    error?: string;
  }>;
  startCloudSignIn?(): { ok: true; url: string } | { ok: false; error: string };
  finishCloudSignIn?(callback: string): Promise<{ ok: boolean; error?: string }>;
  signOutOfCloud?(): unknown;
  requestCloudInvite?(): Promise<{ ok: boolean; error?: string }>;
  readCloudWorkspaces?(): Promise<
    { ok: true; value: { id: string; name: string; updatedAt: string }[] } | { ok: false; error: string }
  >;
  readFolder?(dir: string): CloudFolder;
  goCloud?(request: {
    root: string;
    workspaceId?: string;
    name?: string;
    importCards?: boolean;
  }): Promise<
    | {
        ok: true;
        value: {
          workspace: { id: string; name: string };
          imported: number;
          change: { git: boolean; cards: number; pointer: string; ignore: boolean; clean: boolean };
        };
      }
    | { ok: false; error: string }
  >;
  commitCloudChange?(root: string, kind: "go" | "leave"): { ok: boolean; error?: string };
}

// The rules are ESM and this process is CommonJS, so a plain `import()` would be compiled
// down to a `require()` that cannot load them (the same trick as ./rules.ts).
const importEsm = new Function("url", "return import(url)") as (url: string) => Promise<CloudRules>;

let loaded: Promise<CloudRules> | null = null;

function rules(): Promise<CloudRules> {
  if (!loaded) {
    const file = bundledResource("cli", "dist", "kanban.mjs");
    loaded = fs.existsSync(file)
      ? importEsm(pathToFileURL(file).href).catch(() => ({}))
      : Promise.resolve({});
  }
  return loaded;
}

/** The one sentence every missing call answers with. A build too old to carry the Cloud
 *  moves must say so rather than looking broken. */
const UNAVAILABLE = "This copy of the app cannot reach Cloud. Install a newer one.";

const SIGNED_OUT: CloudAccountView = {
  state: "signed-out",
  handle: null,
  name: null,
  message: null,
  inviteRequestedAt: null,
  configured: false,
  error: null,
};

/** Which account this machine acts as. */
export async function cloudAccount(): Promise<CloudAccountView> {
  const read = (await rules()).readCloudAccount;
  if (!read) return { ...SIGNED_OUT, message: UNAVAILABLE };
  try {
    const account = await read();
    return {
      state: account.state,
      handle: account.handle,
      name: account.name,
      message: account.message,
      inviteRequestedAt: account.inviteRequestedAt,
      configured: account.configured,
      error: account.error ?? null,
    };
  } catch (e) {
    return { ...SIGNED_OUT, error: message(e) };
  }
}

/** The consent screen to open in the user's own browser. */
export async function startCloudSignIn(): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const start = (await rules()).startCloudSignIn;
  if (!start) return { ok: false, error: UNAVAILABLE };
  try {
    return start();
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

/** The answer the app caught on its URL scheme, turned into the machine's session. */
export async function finishCloudSignIn(callback: string): Promise<CloudMoveResult> {
  const finish = (await rules()).finishCloudSignIn;
  if (!finish) return { ok: false, error: UNAVAILABLE };
  try {
    const done = await finish(callback);
    return done.ok ? { ok: true } : { ok: false, error: done.error ?? "" };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function signOutOfCloud(): Promise<CloudMoveResult> {
  const out = (await rules()).signOutOfCloud;
  if (!out) return { ok: false, error: UNAVAILABLE };
  try {
    out();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

/** Ask to be let into the preview (#327). */
export async function requestCloudInvite(): Promise<CloudMoveResult> {
  const ask = (await rules()).requestCloudInvite;
  if (!ask) return { ok: false, error: UNAVAILABLE };
  try {
    const done = await ask();
    return done.ok ? { ok: true } : { ok: false, error: done.error ?? "" };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

/** Every workspace this account has — what Open Cloud board picks from. */
export async function cloudWorkspaces(): Promise<
  { ok: true; workspaces: CloudWorkspaceView[] } | { ok: false; error: string }
> {
  const read = (await rules()).readCloudWorkspaces;
  if (!read) return { ok: false, error: UNAVAILABLE };
  try {
    const answer = await read();
    if (!answer.ok) return { ok: false, error: answer.error };
    return {
      ok: true,
      workspaces: answer.value.map((w) => ({ id: w.id, name: w.name, updatedAt: w.updatedAt })),
    };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

/** What a picked folder already holds — a board, cards to import, a git repository. */
export async function cloudFolder(dir: string): Promise<CloudFolder> {
  const read = (await rules()).readFolder;
  if (!read) return { path: dir, name: dir, board: false, cards: 0, git: false, workspace: "" };
  try {
    return read(dir);
  } catch {
    return { path: dir, name: dir, board: false, cards: 0, git: false, workspace: "" };
  }
}

/** Make or open a workspace on this folder, importing its cards when asked, and point the
 *  checkout at it. */
export async function goCloud(request: CloudGoRequest): Promise<CloudGoResult> {
  const mod = await rules();
  if (!mod.goCloud || !mod.setBoardRoot) return { ok: false, error: UNAVAILABLE };
  try {
    mod.setBoardRoot(request.dir);
    const done = await mod.goCloud({
      root: request.dir,
      ...(request.workspaceId ? { workspaceId: request.workspaceId } : {}),
      ...(request.name ? { name: request.name } : {}),
      ...(request.importCards ? { importCards: true } : {}),
    });
    if (!done.ok) return { ok: false, error: done.error };
    return {
      ok: true,
      workspace: done.value.workspace,
      imported: done.value.imported,
      change: {
        git: done.value.change.git,
        cards: done.value.change.cards,
        pointer: done.value.change.pointer as "add" | "remove" | "none",
        ignore: done.value.change.ignore,
        clean: done.value.change.clean,
      },
    };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

/** Take the offer: one commit carrying the board files leaving git, the pointer and the
 *  `.gitignore` block, and nothing else the working tree holds. */
export async function commitCloudChange(dir: string): Promise<CloudMoveResult> {
  const mod = await rules();
  if (!mod.commitCloudChange || !mod.setBoardRoot) return { ok: false, error: UNAVAILABLE };
  try {
    mod.setBoardRoot(dir);
    const done = mod.commitCloudChange(dir, "go");
    return done.ok ? { ok: true } : { ok: false, error: done.error ?? "" };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));
