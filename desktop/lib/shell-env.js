"use strict";

// The environment a run gets, read from the user's own login shell.
//
// An app opened from the Dock, the Start menu or a .desktop file inherits the
// desktop session's environment, not the terminal's. On macOS and Linux that
// environment usually has a bare `/usr/bin:/bin` PATH — so `claude`, `codex`,
// and anything installed through nvm, Homebrew, asdf or pipx is invisible, and
// a board run would fail with "spawn claude ENOENT" on a machine where the
// agent is plainly installed.
//
// So we ask the shell instead of guessing. `$SHELL -ilc 'env -0'` runs the
// user's own login AND interactive startup files — which is where nvm, mise,
// asdf and the rest put themselves — and prints the result, NUL-separated so a
// value containing newlines survives. A guessed list of folders goes stale the
// day someone changes how they install things; a shell never does.
//
// Windows is left alone: there the process environment is already the user's,
// so there is nothing to read and no shell to read it from.

const { execFile } = require("node:child_process");

// A login+interactive shell can print a banner, ask something, or hang on a
// misbehaving rc file. Past this we give up and run with what we have — a wrong
// PATH is a named error on the run, a hung startup is an app that never opens.
const TIMEOUT_MS = 5000;

// Marks the block that is the environment. Everything the rc files echoed on
// their way past — a greeting, a version notice — lands before it.
const START = "__AI4KANBAN_ENV_START__";

function readShell(shell, args) {
  return new Promise((resolve) => {
    execFile(
      shell,
      args,
      { timeout: TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024, encoding: "utf8" },
      (err, stdout) => {
        if (err && !stdout) return resolve(null);
        const at = stdout.indexOf(START);
        if (at === -1) return resolve(null);
        const env = {};
        for (const entry of stdout.slice(at + START.length).split("\0")) {
          const eq = entry.indexOf("=");
          if (eq <= 0) continue;
          env[entry.slice(0, eq)] = entry.slice(eq + 1);
        }
        resolve(Object.keys(env).length ? env : null);
      },
    );
  });
}

/**
 * The user's login shell environment, or the app's own when there is nothing to
 * read (Windows) or the shell wouldn't answer. Never throws: a failed read is a
 * worse PATH, not a dead app.
 */
async function loginShellEnv() {
  if (process.platform === "win32") return { ...process.env };
  const shell = process.env.SHELL || "/bin/zsh";
  const script = `printf '%s' '${START}'; env -0`;
  // Interactive first — that is where nvm and friends live. A shell that won't
  // run interactively here (some restricted ones refuse) still answers as a
  // plain login shell, which is better than nothing.
  const env = (await readShell(shell, ["-ilc", script])) || (await readShell(shell, ["-lc", script]));
  // This is the user's environment as their terminal has it, and nothing else.
  // What the board's own server needs on top — the port, the board folder, the
  // Node switch — is set by whoever spawns it (lib/server.js), so it always
  // wins over a stale copy the shell happened to export.
  return env || { ...process.env };
}

module.exports = { loginShellEnv };
