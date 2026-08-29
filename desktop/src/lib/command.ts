// Putting `akb` on the user's PATH, from the app (#226).
//
// A desktop user has no `akb`, so the note the app writes for a coding agent names the copy
// inside the app — a `node /Applications/…` line that needs the very Node the app saves
// them from installing. The app already carries the command; installing only points the
// system at it, the way Cursor does for its own `cursor`.
//
// Two systems, two mechanics:
//
//  - macOS writes one symlink named `akb`, pointing at the launcher inside the app
//    (resources/bin/akb). Nothing is copied out, so updating the app updates the command.
//    It goes in the first of the user's own bin folders the PATH already reads —
//    `~/.local/bin`, then `~/bin` — where writing needs no password. Only when the PATH
//    reads neither does it go at `/usr/local/bin/akb`, which usually needs an
//    administrator password; that dialog is the system's own, asked for through osascript,
//    and the app itself never runs as root.
//  - Windows has no symlinks. The installer puts the app's own `bin` folder — which holds
//    `akb.cmd` — on the user's PATH, and the button here repairs that entry when it has
//    gone missing.
//
// Linux gets neither: the build is an AppImage, one file that unpacks itself into a new
// temporary folder every run, so there is no lasting path a symlink could point at.
//
// The symlink is only as good as the path it points at, which is the one rule for refusing
// to write it: an app running from the disk image it was downloaded in, from Downloads, or
// from the read-only copy Gatekeeper makes of an unsigned app, is an app that will be
// somewhere else — or nowhere — the next time it starts.

import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { copy } from "./copy";
import { bundledResource } from "./resources";
import type { CommandInstall, CommandInstallResult, CommandLinkState } from "../shared/bridge";
import type { Env } from "./shell-env";

const MAC = process.platform === "darwin";
const WINDOWS = process.platform === "win32";

/** The fallback link on macOS, for a machine whose PATH reads no bin folder of the user's
 *  own. An `akb` installed from npm lands at this same path, which is why what is already
 *  there has to be read before anything is written. */
const SYSTEM_LINK = "/usr/local/bin/akb";

/** Where the symlink goes on macOS: the first of the user's own bin folders the PATH
 *  already reads — writing there needs no password — else the system fallback. The PATH is
 *  never edited to make a folder qualify; a folder on the PATH but not on disk qualifies,
 *  since making it is the user's own write. */
function macLinks(env: Env): string[] {
  const home = app.getPath("home");
  const onPath = new Set(
    (env.PATH ?? "")
      .split(path.delimiter)
      .filter(Boolean)
      .map((dir) => path.resolve(dir)),
  );
  const own = [path.join(home, ".local", "bin"), path.join(home, "bin")]
    .filter((dir) => onPath.has(path.resolve(dir)))
    .map((dir) => path.join(dir, "akb"));
  return [...own, SYSTEM_LINK];
}

/** Whether writing this link raises the administrator dialog. Only the system folder can:
 *  a folder of the user's own is theirs to write, even when it has to be created first. */
function linkNeedsPassword(link: string): boolean {
  if (link !== SYSTEM_LINK) return false;
  const dir = path.dirname(link);
  try {
    fs.accessSync(fs.existsSync(dir) ? dir : path.dirname(dir), fs.constants.W_OK);
    return false;
  } catch {
    return true;
  }
}

/** The tail of a path that says "this is our launcher inside an AI4Kanban app". The link is
 *  replaced only when it points at one of these — anything else is somebody else's `akb`. */
const OURS = MAC ? path.join("Contents", "Resources", "bin", "akb") : path.join("resources", "bin", "akb");

/** How long the system's password dialog is given. It waits on a person, so this is long. */
const INSTALL_TIMEOUT_MS = 180_000;

/** The launcher this app would point at. */
function launcher(): string {
  return bundledResource("bin", WINDOWS ? "akb.cmd" : "akb");
}

/** The folder holding the launcher — what goes on the PATH on Windows. */
function launcherDir(): string {
  return path.dirname(launcher());
}

function lstat(file: string): fs.Stats | null {
  try {
    return fs.lstatSync(file);
  } catch {
    return null;
  }
}

/** Why this app must not be pointed at, or null when it is somewhere that will last.
 *
 *  One rule, not a list of folders: a symlink is worth nothing once the app it names has
 *  moved. What follows are the three ways a Mac app comes to be running from a path that
 *  isn't its home. */
function blockedReason(): string | null {
  if (!app.isPackaged) {
    return copy().command.blockedSource;
  }
  if (!MAC && !WINDOWS) {
    return copy().command.blockedLinux;
  }
  if (!MAC) return null;
  const exe = app.getPath("exe");
  if (exe.startsWith("/Volumes/")) {
    return copy().command.blockedImage;
  }
  if (exe.includes("/AppTranslocation/")) {
    return copy().command.blockedTranslocated;
  }
  let downloads = "";
  try {
    downloads = app.getPath("downloads");
  } catch {
    // No Downloads folder on this account — then the app isn't in one.
  }
  if (downloads && exe.startsWith(`${downloads}${path.sep}`)) {
    return copy().command.blockedDownloads;
  }
  return null;
}

/** What the target of a symlink is, resolved against the link's own folder. */
function linkTarget(link: string): string {
  const raw = fs.readlinkSync(link);
  return path.resolve(path.dirname(link), raw);
}

/** What is at one link path, in the four words the pane says out loud. */
function linkStateAt(link: string): {
  state: CommandLinkState;
  points: string | null;
  holder: string | null;
} {
  const st = lstat(link);
  if (!st) return { state: "absent", points: null, holder: null };
  if (!st.isSymbolicLink()) {
    return { state: "foreign", points: null, holder: copy().command.holderFile };
  }
  let target: string;
  try {
    target = linkTarget(link);
  } catch {
    return { state: "foreign", points: null, holder: copy().command.holderUnreadable };
  }
  if (!target.endsWith(OURS)) {
    return { state: "foreign", points: target, holder: copy().command.holderLink(target) };
  }
  return fs.existsSync(target)
    ? { state: "installed", points: target, holder: null }
    : { state: "dangling", points: target, holder: null };
}

/** Where `akb` stands on macOS, and the path a press would write. A link of ours — working
 *  or dead — keeps its own path, wherever it is: repairing it elsewhere would leave the old
 *  one shadowing or dangling. Otherwise the press writes the preferred folder. */
function macState(env: Env): {
  writes: string;
  state: CommandLinkState;
  points: string | null;
  holder: string | null;
} {
  const links = macLinks(env);
  for (const link of links) {
    const s = linkStateAt(link);
    if (s.state === "installed" || s.state === "dangling") return { writes: link, ...s };
  }
  const writes = links[0] ?? SYSTEM_LINK;
  return { writes, ...linkStateAt(writes) };
}

/** The first `akb` on the PATH a run would be spawned on — the user's own shell
 *  environment, not this process's. Null when a terminal would find none. */
export function firstOnPath(env: Env, name = "akb"): string | null {
  const names = WINDOWS ? [`${name}.cmd`, `${name}.exe`, `${name}.bat`, name] : [name];
  for (const dir of (env.PATH ?? "").split(path.delimiter)) {
    if (!dir) continue;
    for (const candidate of names) {
      const file = path.join(dir, candidate);
      if (lstat(file)) return file;
    }
  }
  return null;
}

/** Whether the app's `bin` folder is already on the user's PATH (Windows). */
function onWindowsPath(env: Env): boolean {
  const dir = path.resolve(launcherDir()).toLowerCase();
  return (env.PATH ?? "")
    .split(path.delimiter)
    .some((entry) => entry && path.resolve(entry).toLowerCase() === dir);
}

/** Where `akb` stands on this machine — everything the Skill pane says, and everything the
 *  first-launch offer decides from. Reads files and the PATH; starts nothing. */
export function commandState(env: Env): CommandInstall {
  if (!MAC && !WINDOWS) {
    return {
      kind: "none",
      writes: "",
      needsPassword: false,
      state: "absent",
      points: null,
      holder: null,
      otherFirst: null,
      blocked: blockedReason(),
    };
  }
  const blocked = blockedReason();
  if (WINDOWS) {
    const installed = onWindowsPath(env);
    const first = firstOnPath(env);
    return {
      kind: "path",
      writes: launcherDir(),
      needsPassword: false,
      state: installed ? "installed" : "absent",
      points: installed ? launcher() : null,
      holder: null,
      otherFirst: first && path.dirname(first).toLowerCase() !== launcherDir().toLowerCase() ? first : null,
      blocked,
    };
  }
  const { writes, state, points, holder } = macState(env);
  const first = firstOnPath(env);
  return {
    kind: "symlink",
    writes,
    needsPassword: linkNeedsPassword(writes),
    state,
    points,
    holder,
    // Which `akb` a terminal actually runs, when it isn't the one at our path. A PATH entry
    // earlier than ours wins however good our symlink is.
    otherFirst: first && path.resolve(first) !== writes ? first : null,
    blocked,
  };
}

function run(file: string, args: string[], env?: Env): Promise<{ ok: boolean; error: string }> {
  return new Promise((resolve) => {
    execFile(
      file,
      args,
      { timeout: INSTALL_TIMEOUT_MS, env: env ? { ...env } : undefined },
      (err, _stdout, stderr) => {
        if (!err) return resolve({ ok: true, error: "" });
        resolve({ ok: false, error: String(stderr || err.message).trim() });
      },
    );
  });
}

const shellQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
const appleQuote = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/** Write the symlink with the system's own administrator dialog. The app never runs as
 *  root: this hands one line to `osascript`, which is what raises the dialog and what runs
 *  the line if the user answers it. */
async function installWithPassword(target: string, link: string): Promise<{ ok: boolean; error: string }> {
  const line = `/bin/mkdir -p ${shellQuote(path.dirname(link))} && /bin/ln -sfn ${shellQuote(target)} ${shellQuote(link)}`;
  const prompt = copy().command.password(path.dirname(link));
  const script = `do shell script ${appleQuote(line)} with prompt ${appleQuote(prompt)} with administrator privileges`;
  const res = await run("/usr/bin/osascript", ["-e", script]);
  // The one failure that isn't a failure to report: the user closed the dialog.
  if (!res.ok && /User canceled|-128/.test(res.error)) {
    return { ok: false, error: copy().command.cancelled };
  }
  return res;
}

/** Put `akb` on the PATH. The whole move, including the refusals — nothing else decides
 *  whether it may run. */
export async function installCommand(env: Env): Promise<CommandInstallResult> {
  const state = commandState(env);
  if (state.kind === "none") {
    return { ok: false, error: state.blocked ?? copy().command.noWay, state };
  }
  if (state.blocked) return { ok: false, error: state.blocked, state };
  if (state.state === "foreign") {
    return {
      ok: false,
      error: copy().command.held(state.writes, state.holder ?? copy().command.holderUnknown),
      state,
    };
  }
  const target = launcher();
  if (!fs.existsSync(target)) {
    return { ok: false, error: copy().command.missing(target), state };
  }

  if (WINDOWS) {
    const res = await addToWindowsPath(target);
    return { ...res, state: commandState(env) };
  }

  let result = await symlinkDirectly(target, state.writes);
  // The dialog only ever backs the system folder: elevating into a folder of the user's
  // own would leave a root-owned link where everything else is theirs.
  if (!result.ok && result.needsPassword && state.writes === SYSTEM_LINK) {
    result = await installWithPassword(target, state.writes);
  }
  const after = commandState(env);
  if (!result.ok) return { ok: false, error: result.error, state: after };
  return { ok: true, state: after };
}

/** Try it without a password first — a folder of the user's own never needs one, plenty of
 *  machines have a `/usr/local/bin` the user owns, and asking for a password nobody needs
 *  is asking for a refusal. */
async function symlinkDirectly(
  target: string,
  link: string,
): Promise<{ ok: boolean; error: string; needsPassword?: boolean }> {
  try {
    fs.mkdirSync(path.dirname(link), { recursive: true });
    // Replacing our own link, or a dead one: unlink first, since symlink() will not
    // overwrite. Anything else was turned away above.
    if (lstat(link)) fs.unlinkSync(link);
    fs.symlinkSync(target, link);
    return { ok: true, error: "" };
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    const denied = code === "EACCES" || code === "EPERM" || code === "EROFS";
    return { ok: false, error: e instanceof Error ? e.message : String(e), needsPassword: denied };
  }
}

/** Windows: put the app's `bin` folder back on the user's PATH. The installer put it there
 *  in the first place, and both run the same script beside the launcher — one piece of code
 *  edits the PATH, whoever asks for it. */
async function addToWindowsPath(target: string): Promise<{ ok: boolean; error: string }> {
  const script = path.join(path.dirname(target), "path.ps1");
  if (!fs.existsSync(script)) {
    return { ok: false, error: copy().command.missingScript(script) };
  }
  return run("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    script,
    "-Add",
  ]);
}

/** Does `akb` answer, in the environment the board starts its runs in? Asked before the
 *  open project's note is rewritten to name it — a note pointing at a command that doesn't
 *  answer is worse than one naming the long path that does. */
export async function commandAnswers(env: Env): Promise<boolean> {
  const found = firstOnPath(env);
  if (!found) return false;
  const res = await run(found, ["version"], env);
  return res.ok;
}

/** Rewrite the open project's skill note so the command it hands a coding agent is `akb`.
 *
 *  Through the command that was just installed, not through the copy inside the app: it is
 *  the one on the PATH that the note is about to name, and running it is how we know it
 *  works. `skill refresh` writes no folder that isn't already there — a project without the
 *  skill is a project that never asked for one. */
export async function refreshSkillNote(env: Env, boardDir: string): Promise<void> {
  const found = firstOnPath(env);
  if (!found) return;
  await run(found, ["skill", "refresh", "--dir", boardDir], env);
}
