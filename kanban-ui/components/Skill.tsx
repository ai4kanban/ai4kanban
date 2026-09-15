"use client";

// The coding agent skill, added from Configuration → General (#174).
//
// A board no longer arrives with it. Installing scaffolds `docs/kanban/` and stops there,
// so this group is the one thing that makes a project readable by Claude Code or Codex —
// and it is plainly optional: nothing about the board stops working without it.
//
// Two rows, because there are two things to have: the skill in this project, and the `akb`
// command on the PATH. Each row says what it is and what state it is in, and carries the
// button that fixes it. Nothing above them repeats that in a sentence.
//
// ── What this screen knows, and what it doesn't ─────────────────────────────
// It knows there is a skill, which folders it lands in, and how current each one is. It
// does NOT know what a skill folder holds — that is the board's own rules, and this asks
// them. So the files can move or change (#213 moves the command out of the repo) and this
// group keeps working without a line changed here.
//
// The button writes files in the project and nothing else. When the `akb` on the user's
// PATH is behind the copy this board runs, or missing, it hands over the line that fixes
// that and never runs it: a global install is the user's to type, the same way `akb update`
// names the line rather than replacing itself.
//
// The desktop app is the exception (#780). It carries its own `akb` and links it up on
// first launch, so the row there answers out of the app's own state and has a button for
// everything it can put right. The npm line never appears in it: typing it would put a
// second command on the machine, updating apart from the app from then on. A browser tab
// and Linux — where an AppImage has no lasting path to link to — keep that line as their
// only answer.

import { useCallback, useEffect, useState } from "react";
import { FiAlertCircle, FiCheck, FiChevronDown, FiCopy, FiRefreshCw } from "react-icons/fi";
import { installSkillAction, skillStateAction } from "@/app/actions";
import type { ConfigurationCopy } from "@/i18n/configuration/types";
import { Rich } from "@/i18n/rich";
import { useCopy } from "@/i18n/use-copy";
import type { CommandState, SkillFolder, SkillInstall, SkillState } from "@/lib/types";
import { Button } from "./button";
import { type CommandInstall, commandRowState, type CommandRowState, InstallCommand, readCommandInstall } from "./desktop";
import { Group, Note, Panel, QUIET_BTN, Row, Status } from "./settings";

/** The **Setup** group of Configuration → General. It reads its own state when it first
 *  draws — the board's poll never carries it, since one of the two answers spawns a
 *  process. */
export function SetupGroup({ onError }: { onError?: (msg: string) => void }) {
  const c = useCopy().configuration.skill;
  const caption = useCopy().configuration.general.setup;
  const [skill, setSkill] = useState<SkillState | null>(null);
  const [command, setCommand] = useState<CommandState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [installing, setInstalling] = useState(false);
  // What the last press wrote, folder by folder. Cleared by nothing: it is the receipt for
  // the press, and it stands until the dialog closes.
  const [done, setDone] = useState<SkillInstall | null>(null);
  // Where the app's own `akb` stands. Null in a browser and on Linux, where the app has no
  // say and the line to type below is the answer.
  const [appCommand, setAppCommand] = useState<CommandInstall | null>(null);
  // What the app's button last found. It sits under the rows because the row it belongs to
  // has no width for a sentence.
  const [commandNote, setCommandNote] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setChecking(true);
    try {
      const [res, install] = await Promise.all([skillStateAction(), readCommandInstall()]);
      setSkill(res.skill);
      setCommand(res.command);
      setAppCommand(install);
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
  // In the app, the row answers out of the app's own state; everywhere else out of the
  // `akb` the board found on the PATH.
  const row = commandRowState(appCommand);
  const commandReady = !checking && (row ? row === "ready" : !!command && !command.behind);
  const note = appNote(row, appCommand, c);

  return (
    <Group
      title={caption}
      action={
        <button
          type="button"
          disabled={checking}
          onClick={() => void load()}
          className={QUIET_BTN}
        >
          <FiRefreshCw className="text-[12px]" aria-hidden />
          {checking ? c.checking : c.checkAgain}
        </button>
      }
    >
      <Panel>
        <div aria-live="polite">
          <Row label={c.skillRow}>
            <Status ready={!!skill && !skillNeedsWork}>
              {skill ? skillStatus(skill, c) : c.checking}
            </Status>
            {skillNeedsWork && (
              <Button size="sm" disabled={installing || !skill.folders.length} onClick={() => void install()}>
                {installing ? c.writing : buttonLabel(skill, c)}
              </Button>
            )}
          </Row>

          <Row label={c.commandRow}>
            <Status ready={commandReady}>{commandStatus(row, command, checking, c)}</Status>
            {/* The desktop app can point the PATH at the copy it carries. In a browser, on
                Linux, and where another `akb` comes first, this draws nothing and the line
                to type below is the answer. */}
            <InstallCommand
              install={appCommand}
              onDone={(state, ok) => {
                setAppCommand(state);
                // The PATH has changed under the rest of the group: what the skill row says
                // is read from the command itself, and it has to be asked again.
                if (ok) void load();
              }}
              onNote={setCommandNote}
            />
          </Row>
        </div>
      </Panel>

      {loadError && <Note icon={<FiAlertCircle />}>{loadError}</Note>}

      {/* What the app's own `akb` needs, when it needs anything. */}
      {!checking && note && (
        <Note icon={<FiAlertCircle />}>
          <Rich>{note}</Rich>
        </Note>
      )}

      {commandNote && (
        <Note icon={commandNote.ok ? <FiCheck className="text-nb-mint-ink" /> : <FiAlertCircle />}>
          <Rich>{commandNote.text}</Rich>
        </Note>
      )}

      {/* The line that fixes an `akb` this board can't reach — a browser tab, or Linux.
          Never in the app, which carries its own copy: typing it there would install a
          second one. Never run for the user either: a global install is theirs to type. */}
      {!checking && !row && command?.behind && <CommandLine line={command.line} copy={c} />}

      {done && <Receipt result={done} copy={c} />}

      {skill?.folders.length ? (
        <details className="group mt-3">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[12px] font-[700] text-nb-ink-soft hover:text-nb-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nb-accent [&::-webkit-details-marker]:hidden">
            <FiChevronDown className="transition-transform duration-100 group-open:rotate-180" aria-hidden />
            {c.details}
          </summary>
          <div className="mt-2 pl-5">
            <p className="mb-1.5 text-[11.5px] text-nb-ink-soft">{c.writtenBy(skill.version)}</p>
            <ul className="flex flex-col gap-1.5">
              {skill.folders.map((folder) => (
                <FolderRow key={folder.path} folder={folder} carries={skill.version} copy={c} />
              ))}
            </ul>
            {!skillNeedsWork && (
              <div className="mt-2.5 flex items-center gap-3 max-sm:flex-col max-sm:items-start">
                <Button size="sm" variant="ghost" disabled={installing} onClick={() => void install()}>
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
    </Group>
  );
}

type SkillCopy = ConfigurationCopy["skill"];

function skillStatus(skill: SkillState, c: SkillCopy): string {
  if (!skill.folders.length) return c.status.unchecked;
  if (!skill.installed) return c.status.notInstalled;
  if (skill.folders.some((folder) => folder.state === "absent")) return c.status.partial;
  if (skill.outdated) return c.status.updateAvailable;
  return c.status.ready(skill.version);
}

/** Which word the app's five states wear. `blocked` reads "not ready" like `absent`: the
 *  command isn't there either way, and the line under the rows is where the difference is. */
const APP_STATUS = {
  ready: "ready",
  absent: "notReady",
  blocked: "notReady",
  dangling: "needsRepair",
  otherFirst: "otherFirst",
} as const;

function commandStatus(
  row: CommandRowState | null,
  command: CommandState | null,
  checking: boolean,
  c: SkillCopy,
): string {
  if (checking) return c.checking;
  if (row) return c.app.status[APP_STATUS[row]];
  if (!command) return c.commandStatus.unchecked;
  if (!command.onPath) return c.commandStatus.notFound;
  if (command.behind) return c.commandStatus.behind(command.onPath);
  return c.commandStatus.ready(command.onPath);
}

/** The line under the rows, in the app. `blocked` is the app's own reason — it names the
 *  folder it is running from, which nothing on this side knows. */
function appNote(
  row: CommandRowState | null,
  install: CommandInstall | null,
  c: SkillCopy,
): string | null {
  switch (row) {
    case "absent":
      return c.app.note.absent;
    case "dangling":
      return c.app.note.dangling;
    case "blocked":
      return install?.blocked ?? null;
    case "otherFirst":
      // `writes` is the path when another `akb` holds the very one we would write.
      return c.app.note.otherFirst(install?.otherFirst || install?.writes || "");
    default:
      return null;
  }
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
    <li className="flex items-start gap-2 text-[12px] leading-relaxed">
      <span
        className="mt-[6px] size-[6px] shrink-0 rounded-full"
        style={{
          background: there ? "var(--color-nb-mint-ink)" : "color-mix(in srgb, var(--color-nb-ink) 25%, transparent)",
        }}
        aria-hidden
      />
      <span className="min-w-0">
        <code className="font-mono text-[11.5px] text-nb-ink">{folder.path}/</code>{" "}
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
      className="mt-3 rounded-[9px] px-3 py-2"
      aria-live="polite"
      style={{ background: ok ? "var(--color-nb-mint-soft)" : "var(--color-nb-peach-soft)" }}
    >
      <p
        className="flex items-start gap-2 text-[12.5px] font-[700]"
        style={{ color: ok ? "var(--color-nb-mint-ink)" : "var(--color-nb-peach-ink)" }}
      >
        {ok ? <FiCheck className="mt-[2px] shrink-0" aria-hidden /> : <FiAlertCircle className="mt-[2px] shrink-0" aria-hidden />}
        {ok ? copy.receipt.ok : result.error || copy.receipt.nothing}
      </p>
      {result.wrote.length > 0 && (
        <ul className="mt-1.5 flex flex-col gap-1">
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
        <p key={s.path} className="mt-1 text-[12px] leading-relaxed text-nb-ink-soft">
          <code className="font-mono text-[11.5px]">{s.path}/</code> — {s.why}
        </p>
      ))}
    </div>
  );
}

// The line that puts a current `akb` on the PATH. One sentence and the command, because
// the row above already said what is wrong with the one that is there.
function CommandLine({ line, copy }: { line: string; copy: SkillCopy }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <div className="mt-3">
      <p className="text-[12px] leading-relaxed text-nb-ink-soft">{copy.behind.runThis}</p>
      <div className="mt-1.5 flex items-center gap-1 rounded-[10px] bg-nb-wash py-2 pl-3 pr-1.5">
        <code className="min-w-0 flex-1 break-words font-mono text-[12px] text-nb-ink">{line}</code>
        <button
          type="button"
          title={copy.behind.copy}
          onClick={() => {
            navigator.clipboard
              ?.writeText(line)
              .then(() => setCopied(true))
              // No clipboard permission (or no clipboard at all) — the line is on screen to
              // select by hand, so there is nothing to report.
              .catch(() => {});
          }}
          className="shrink-0 cursor-pointer rounded-[7px] p-1.5 text-nb-ink-soft transition-colors hover:bg-nb-canvas hover:text-nb-ink"
        >
          {copied ? <FiCheck size={14} className="text-nb-mint-ink" /> : <FiCopy size={14} />}
        </button>
      </div>
    </div>
  );
}
