"use client";

// The coding agent skill, added from here (#174).
//
// A board no longer arrives with it. Installing scaffolds `docs/kanban/` and stops there,
// so this section is the one thing that makes a project readable by Claude Code or Codex —
// and it is plainly optional: nothing about the board stops working without it.
//
// ── What this screen knows, and what it doesn't ─────────────────────────────
// It knows there is a skill, which folders it lands in, and how current each one is. It
// does NOT know what a skill folder holds — that is the board's own rules, and this asks
// them. So the files can move or change (#213 moves the command out of the repo) and this
// pane keeps working without a line changed here.
//
// The button writes files in the project and nothing else. When the `akb` on the user's
// PATH is behind the copy this board runs, or missing, it hands over the line that fixes
// that and never runs it: a global install is the user's to type, the same way `akb update`
// names the line rather than replacing itself. Saying nothing would be worse — the note
// this button just wrote points the agent at `akb`, so an old command would quietly serve
// old flows in a project that was just refreshed.

import { useCallback, useEffect, useState } from "react";
import { FiAlertCircle, FiCheck, FiCopy, FiRefreshCw } from "react-icons/fi";
import { installSkillAction, skillStateAction } from "@/app/actions";
import type { CommandState, SkillFolder, SkillInstall, SkillState } from "@/lib/types";
import { Button } from "./button";
import { InstallCommand } from "./desktop";

/** The section in the Configuration dialog. It reads its own state when it first draws —
 *  the board's poll never carries it, since one of the two answers spawns a process. */
export function SkillPanel({ onError }: { onError?: (msg: string) => void }) {
  const [skill, setSkill] = useState<SkillState | null>(null);
  const [command, setCommand] = useState<CommandState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  // What the last press wrote, folder by folder. Cleared by nothing: it is the receipt for
  // the press, and it stands until the dialog closes.
  const [done, setDone] = useState<SkillInstall | null>(null);
  // Whether the app's own button below would put a working `akb` on the PATH. False in a
  // browser, on Linux, and when the `akb` a terminal runs came from somewhere else — the
  // three cases where a line to type is still the only answer.
  const [buttonFixes, setButtonFixes] = useState(false);

  const load = useCallback(async () => {
    const res = await skillStateAction();
    setSkill(res.skill);
    setCommand(res.command);
    setLoadError(res.error ?? null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const install = async () => {
    if (installing) return;
    setInstalling(true);
    setDone(null);
    try {
      const res = await installSkillAction();
      setDone(res);
      setSkill(res.state.folders.length ? res.state : skill);
      if (!res.ok) onError?.(res.error || "couldn't add the skill");
      // The command on the PATH can't have changed, but the folders have — re-read so the
      // list under the button is what is on disk rather than what was there a click ago.
      await load();
    } catch (e) {
      onError?.(e instanceof Error ? e.message : String(e));
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-[17px] font-[800] tracking-[-0.02em] text-nb-ink">
          Coding agent skill
        </h3>
        <p className="mt-1 max-w-[56ch] text-[13px] leading-relaxed text-nb-ink-soft">
          Add the optional project instructions that let Claude Code or Codex work with
          this board directly.
        </p>
      </div>

      {loadError && (
        <p className="flex items-start gap-1.5 text-[12px] leading-relaxed text-nb-ink-soft">
          <FiAlertCircle className="mt-[3px] shrink-0" aria-hidden />
          <span>{loadError}</span>
        </p>
      )}

      <div className="border-t border-nb-ink/12 pt-4">
        {!skill ? (
          <p className="text-[13px] text-nb-ink-soft">Looking at this project…</p>
        ) : (
          <>
            <p className="mb-3 text-[13px] font-[700]">{headline(skill)}</p>
            <ul className="flex flex-col gap-2">
              {skill.folders.map((folder) => (
                <FolderRow key={folder.path} folder={folder} carries={skill.version} />
              ))}
            </ul>
            <div className="mt-4 flex items-center gap-3">
              <Button
                size="sm"
                disabled={installing || !skill.folders.length}
                onClick={() => void install()}
              >
                {installing ? (
                  "Writing…"
                ) : (
                  <>
                    <FiRefreshCw className="text-[13px]" aria-hidden />
                    {buttonLabel(skill)}
                  </>
                )}
              </Button>
              <p className="text-[12px] leading-relaxed text-nb-ink-soft">
                Writes files in this repo. Review <code>git diff</code> before committing.
              </p>
            </div>
          </>
        )}
      </div>

      {done && <Receipt result={done} />}

      {/* The second button: this one writes outside the repo (#226). Nothing at all in a
          browser or on Linux, where the line below is still the whole answer. */}
      <InstallCommand onInstalled={() => void load()} onFixable={setButtonFixes} />

      {command?.behind && <CommandBehind command={command} button={buttonFixes} />}
    </div>
  );
}

// The one line at the top of the state block: where this project stands, in words rather
// than in the folder list under it.
function headline(skill: SkillState): string {
  if (!skill.folders.length) return "This project's copy of the board's rules is too old to say.";
  if (!skill.installed) return "Not installed — your coding agent can't see this board yet.";
  if (skill.outdated) return `Older than this board (${skill.version}) — the button brings it up to date.`;
  return "Installed and up to date.";
}

function buttonLabel(skill: SkillState): string {
  if (!skill.installed) return "Add the skill";
  if (skill.outdated) return "Bring it up to date";
  return "Write it again";
}

// One folder, and what is in it. The state words are the board's own answer, not a guess
// this screen makes from a file listing.
function FolderRow({ folder, carries }: { folder: SkillFolder; carries: string }) {
  const there = folder.state !== "absent";
  return (
    <li className="flex items-start gap-2 text-[12.5px] leading-relaxed">
      <span
        className="mt-[6px] size-[6px] shrink-0 rounded-full"
        style={{
          background: there ? "var(--color-nb-mint-ink)" : "color-mix(in srgb, var(--color-nb-ink) 25%, transparent)",
        }}
        aria-hidden
      />
      <span className="min-w-0">
        <code className="font-mono text-[12px] text-nb-ink">{folder.path}/</code>{" "}
        <span className="text-nb-ink-soft">— {folderWords(folder, carries)}</span>
      </span>
    </li>
  );
}

function folderWords(folder: SkillFolder, carries: string): string {
  switch (folder.state) {
    case "absent":
      return `nothing here (${folder.agent})`;
    case "linked":
      return "a link into a source checkout — left alone";
    case "unknown":
      return `installed, though it doesn't say which version (${folder.agent})`;
    case "stale":
      return `${folder.version}, older than ${carries} (${folder.agent})`;
    default:
      return `${folder.version} (${folder.agent})`;
  }
}

// What the press wrote, folder by folder — in the board's words, so a change to what a
// skill folder holds shows up here with nothing edited on this screen.
function Receipt({ result }: { result: SkillInstall }) {
  const ok = result.ok;
  return (
    <div
      className="rounded-[10px] border-[1.5px] border-nb-ink px-3 py-2.5"
      aria-live="polite"
      style={{ background: ok ? "var(--color-nb-mint-soft)" : "var(--color-nb-peach-soft)" }}
    >
      <p
        className="flex items-start gap-2 text-[13px] font-[700]"
        style={{ color: ok ? "var(--color-nb-mint-ink)" : "var(--color-nb-peach-ink)" }}
      >
        {ok ? <FiCheck className="mt-[2px] shrink-0" aria-hidden /> : <FiAlertCircle className="mt-[2px] shrink-0" aria-hidden />}
        {ok ? "Done — your coding agent can drive this board." : result.error || "Nothing was written."}
      </p>
      {result.wrote.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {result.wrote.map((w) => (
            <li key={w.path} className="text-[12px] leading-relaxed text-nb-ink">
              <code className="font-mono text-[11.5px]">{w.path}/</code> — {w.refreshed ? "refreshed" : "wrote"} {w.files}{" "}
              <span className="text-nb-ink-soft">({w.agent})</span>
            </li>
          ))}
        </ul>
      )}
      {result.skipped.map((s) => (
        <p key={s.path} className="mt-1.5 text-[12px] leading-relaxed text-nb-ink-soft">
          <code className="font-mono text-[11.5px]">{s.path}/</code> — {s.why}
        </p>
      ))}
    </div>
  );
}

// The `akb` on this machine is older than the board, or isn't there at all. The flows the
// coding agent works by come out of that command, so this is worth saying even when the
// files in the repo are current.
//
// In the app the button above is the answer, and the line to type is not shown at all —
// pressing it beats pasting it. The line stays for the two cases a press can't fix: the
// board in a browser, and an `akb` that came from somewhere else and comes first on the
// PATH. Then it is the user's line to run, never ours.
function CommandBehind({ command, button }: { command: CommandState; button: boolean }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  const said = command.onPath
    ? `The \`akb\` on your PATH is ${command.onPath}; this board runs ${command.version}.`
    : "There is no working `akb` on your PATH.";

  if (button) {
    return (
      <div className="border-t border-nb-ink/12 pt-4">
        <p className="text-[12.5px] leading-relaxed text-nb-ink-soft">
          {said} The flows your coding agent follows come out of that command, so an old one
          means old flows. The button above puts this app&rsquo;s own copy there.
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-nb-ink/12 pt-4">
      <p className="text-[12.5px] leading-relaxed text-nb-ink-soft">
        {said}{" "}
        The flows your coding agent follows come out of that command, so an old one means
        old flows. Run this yourself — nothing here does:
      </p>
      <div className="mt-2 flex items-center gap-1 rounded-[9px] bg-nb-wash py-1 pr-1 pl-3">
        <code className="min-w-0 flex-1 font-mono text-[12px] break-words text-nb-ink">{command.line}</code>
        <button
          type="button"
          title="Copy"
          onClick={() => {
            navigator.clipboard
              ?.writeText(command.line)
              .then(() => setCopied(true))
              // No clipboard permission (or no clipboard at all) — the line is on screen to
              // select by hand, so there is nothing to report.
              .catch(() => {});
          }}
          className="shrink-0 cursor-pointer rounded-[7px] p-1.5 text-nb-ink-soft transition-colors hover:bg-nb-ink/[0.07] hover:text-nb-ink"
        >
          {copied ? <FiCheck size={14} className="text-nb-mint-ink" /> : <FiCopy size={14} />}
        </button>
      </div>
    </div>
  );
}
