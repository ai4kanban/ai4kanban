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
import { FiAlertCircle, FiCheck, FiChevronDown, FiCopy, FiRefreshCw } from "react-icons/fi";
import { installSkillAction, skillStateAction } from "@/app/actions";
import type { ConfigurationCopy } from "@/i18n/configuration/types";
import { Rich } from "@/i18n/rich";
import { useCopy } from "@/i18n/use-copy";
import type { CommandState, SkillFolder, SkillInstall, SkillState } from "@/lib/types";
import { Button } from "./button";
import { InstallCommand } from "./desktop";

/** The section in the Configuration dialog. It reads its own state when it first draws —
 *  the board's poll never carries it, since one of the two answers spawns a process. */
export function SkillPanel({ onError }: { onError?: (msg: string) => void }) {
  const c = useCopy().configuration.skill;
  const [skill, setSkill] = useState<SkillState | null>(null);
  const [command, setCommand] = useState<CommandState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [installing, setInstalling] = useState(false);
  // What the last press wrote, folder by folder. Cleared by nothing: it is the receipt for
  // the press, and it stands until the dialog closes.
  const [done, setDone] = useState<SkillInstall | null>(null);
  // Whether the app's own button below would put a working `akb` on the PATH. False in a
  // browser, on Linux, and when the `akb` a terminal runs came from somewhere else — the
  // three cases where a line to type is still the only answer.
  const [buttonFixes, setButtonFixes] = useState(false);

  const load = useCallback(async () => {
    setChecking(true);
    try {
      const res = await skillStateAction();
      setSkill(res.skill);
      setCommand(res.command);
      setLoadError(res.error ?? null);
    } finally {
      setChecking(false);
    }
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
      if (!res.ok) onError?.(res.error || c.addFailed);
      // The command on the PATH can't have changed, but the folders have — re-read so the
      // list under the button is what is on disk rather than what was there a click ago.
      await load();
    } catch (e) {
      onError?.(e instanceof Error ? e.message : String(e));
    } finally {
      setInstalling(false);
    }
  };

  const missing = skill?.folders.some((folder) => folder.state === "absent") ?? false;
  const skillNeedsWork = !!skill && (!skill.installed || skill.outdated || missing);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-[17px] font-[800] tracking-[-0.02em] text-nb-ink">{c.title}</h3>
        <p className="mt-1 max-w-[58ch] text-[13px] leading-relaxed text-nb-ink-soft">
          <Rich>{c.blurb}</Rich>
        </p>
      </div>

      {loadError && (
        <p className="flex items-start gap-1.5 text-[12px] leading-relaxed text-nb-ink-soft">
          <FiAlertCircle className="mt-[3px] shrink-0" aria-hidden />
          <span>{loadError}</span>
        </p>
      )}

      <div className="rounded-[10px] bg-nb-wash p-4" aria-live="polite">
        {!skill ? (
          <p className="text-[13px] text-nb-ink-soft">{c.checking}</p>
        ) : (
          <div className="flex items-start justify-between gap-4 max-sm:flex-col">
            <div className="flex min-w-0 items-start gap-3">
              <StatusMark ready={!checking && !skillNeedsWork && !!command && !command.behind} />
              <div>
                <p className="text-[14px] font-[800] text-nb-ink">{headline(skill, command, c)}</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-nb-ink-soft">
                  {statusDetail(skill, command, c)}
                </p>
              </div>
            </div>
            {skillNeedsWork ? (
              <Button
                size="sm"
                className="shrink-0"
                disabled={installing || !skill.folders.length}
                onClick={() => void install()}
              >
                {installing ? c.writing : buttonLabel(skill, c)}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="shrink-0"
                disabled={checking}
                onClick={() => void load()}
              >
                <FiRefreshCw className="text-[13px]" aria-hidden />
                {checking ? c.commandStatus.checking : c.checkAgain}
              </Button>
            )}
          </div>
        )}
      </div>

      {done && <Receipt result={done} copy={c} />}

      {skill && (
        <dl className="flex flex-col gap-2">
          <CheckRow
            label={c.skillRow}
            status={skillStatus(skill, c)}
            ready={!skillNeedsWork}
          />
          <CheckRow
            label={c.commandRow}
            status={commandStatus(command, checking, c)}
            ready={!checking && !!command && !command.behind}
          />
        </dl>
      )}

      {/* The desktop app can repair a missing command. Browsers and source builds leave
          the small copyable command below as the answer. */}
      <InstallCommand onInstalled={() => void load()} onFixable={setButtonFixes} />

      {command?.behind && <CommandBehind command={command} button={buttonFixes} copy={c} />}

      {skill?.folders.length ? (
        <details className="group border-t border-nb-ink/12 pt-3">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[12px] font-[700] text-nb-ink-soft hover:text-nb-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nb-accent [&::-webkit-details-marker]:hidden">
            <FiChevronDown className="transition-transform duration-100 group-open:rotate-180" aria-hidden />
            {c.details}
          </summary>
          <div className="mt-3 pl-5">
            <p className="mb-2 text-[11.5px] text-nb-ink-soft">{c.writtenBy(skill.version)}</p>
            <ul className="flex flex-col gap-2">
              {skill.folders.map((folder) => (
                <FolderRow key={folder.path} folder={folder} carries={skill.version} copy={c} />
              ))}
            </ul>
            {!skillNeedsWork && (
              <div className="mt-3 flex items-center gap-3 max-sm:items-start max-sm:flex-col">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={installing}
                  onClick={() => void install()}
                >
                  <FiRefreshCw className="text-[13px]" aria-hidden />
                  {installing ? c.writing : c.writeAgain}
                </Button>
                <p className="text-[11.5px] leading-relaxed text-nb-ink-soft">
                  <Rich>{c.reviewDiff}</Rich>
                </p>
              </div>
            )}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function StatusMark({ ready }: { ready: boolean }) {
  return (
    <span
      className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${
        ready ? "bg-nb-mint-soft text-nb-mint-ink" : "bg-nb-peach-soft text-nb-peach-ink"
      }`}
    >
      {ready ? <FiCheck aria-hidden /> : <FiAlertCircle aria-hidden />}
    </span>
  );
}

function CheckRow({ label, status, ready }: { label: string; status: string; ready: boolean }) {
  return (
    <div className="grid grid-cols-[10rem_minmax(0,1fr)] items-baseline gap-x-4 px-1 text-[12.5px] max-sm:grid-cols-1 max-sm:gap-y-0.5">
      <dt className="font-[700] text-nb-ink">{label}</dt>
      <dd className={ready ? "text-nb-mint-ink" : "text-nb-ink-soft"}>{status}</dd>
    </div>
  );
}

type SkillCopy = ConfigurationCopy["skill"];

function headline(skill: SkillState, command: CommandState | null, c: SkillCopy): string {
  if (!skill.folders.length) return c.headline.unchecked;
  if (!skill.installed || skill.folders.some((folder) => folder.state === "absent")) {
    return c.headline.unfinished;
  }
  if (skill.outdated || command?.behind) return c.headline.update;
  return c.headline.ready;
}

function statusDetail(skill: SkillState, command: CommandState | null, c: SkillCopy): string {
  if (!skill.folders.length) return c.detail.unchecked;
  const available = skill.folders.filter((folder) => folder.state !== "absent").map((folder) => folder.agent);
  if (!available.length) return c.detail.none;
  if (skill.folders.some((folder) => folder.state === "absent")) {
    return c.detail.some(available.join(", "));
  }
  if (skill.outdated) return c.detail.outdated;
  if (command?.behind) return c.detail.commandBehind;
  return c.detail.ready(available.join(", "));
}

function skillStatus(skill: SkillState, c: SkillCopy): string {
  if (!skill.folders.length) return c.status.unchecked;
  if (!skill.installed) return c.status.notInstalled;
  if (skill.folders.some((folder) => folder.state === "absent")) return c.status.partial;
  if (skill.outdated) return c.status.updateAvailable;
  return c.status.ready(skill.version);
}

function commandStatus(command: CommandState | null, checking: boolean, c: SkillCopy): string {
  if (checking) return c.commandStatus.checking;
  if (!command) return c.commandStatus.unchecked;
  if (!command.onPath) return c.commandStatus.notFound;
  if (command.behind) return c.commandStatus.behind(command.onPath);
  return c.commandStatus.ready(command.onPath);
}

function buttonLabel(skill: SkillState, c: SkillCopy): string {
  if (!skill.installed) return c.button.add;
  if (skill.folders.some((folder) => folder.state === "absent")) return c.button.addRest;
  return c.button.update;
}

// One folder, and what is in it. The state words are the board's own answer, not a guess
// this screen makes from a file listing.
function FolderRow({ folder, carries, copy }: { folder: SkillFolder; carries: string; copy: SkillCopy }) {
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
        <span className="text-nb-ink-soft">— {folderWords(folder, carries, copy)}</span>
      </span>
    </li>
  );
}

function folderWords(folder: SkillFolder, carries: string, c: SkillCopy): string {
  switch (folder.state) {
    case "absent":
      return c.folder.absent(folder.agent);
    case "linked":
      return c.folder.linked;
    case "unknown":
      return c.folder.unknown(folder.agent);
    case "stale":
      return c.folder.stale(folder.version, carries, folder.agent);
    default:
      return c.folder.ready(folder.version, folder.agent);
  }
}

// What the press wrote, folder by folder — in the board's words, so a change to what a
// skill folder holds shows up here with nothing edited on this screen.
function Receipt({ result, copy }: { result: SkillInstall; copy: SkillCopy }) {
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
        {ok ? copy.receipt.ok : result.error || copy.receipt.nothing}
      </p>
      {result.wrote.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {result.wrote.map((w) => (
            <li key={w.path} className="text-[12px] leading-relaxed text-nb-ink">
              <Rich code="font-mono text-[11.5px]">
                {(w.refreshed ? copy.receipt.refreshed : copy.receipt.wrote)(w.path, String(w.files))}
              </Rich>{" "}
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
function CommandBehind({ command, button, copy }: { command: CommandState; button: boolean; copy: SkillCopy }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  const said = command.onPath
    ? copy.behind.onPath(command.onPath, command.version)
    : copy.behind.none;

  if (button) {
    return (
      <p className="text-[12px] leading-relaxed text-nb-ink-soft">
        {said} {copy.behind.useButton}
      </p>
    );
  }

  return (
    <div className="rounded-[10px] bg-nb-peach-soft p-3">
      <p className="text-[12.5px] font-[700] text-nb-peach-ink">{copy.behind.title}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-nb-ink-soft">
        {said} {copy.behind.runThis}
      </p>
      <div className="mt-2 flex items-center gap-1 rounded-[9px] bg-nb-wash py-1 pr-1 pl-3">
        <code className="min-w-0 flex-1 font-mono text-[12px] break-words text-nb-ink">{command.line}</code>
        <button
          type="button"
          title={copy.behind.copy}
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
