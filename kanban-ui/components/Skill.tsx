"use client";

// The Setup group of Configuration → General (#174, #1984).
//
// Opening a project already writes its skill, so this group shows only when the skill or the
// `akb` command needs the user: just the failing row, one reason, and its button.
//
// The skill button writes files in the project and nothing else. A global install is the
// user's to type, so outside the app the `akb` row hands over the line and never runs it.
//
// The desktop app is the exception (#780): it carries its own `akb`, so the row there answers
// out of the app's own state and never shows the npm line — that would put a second command
// on the machine. A browser tab and Linux keep the line as their only answer.

import { useCallback, useEffect, useState } from "react";
import { FiAlertCircle, FiCheck, FiCopy, FiRefreshCw } from "react-icons/fi";
import { installSkillAction, skillStateAction } from "@/app/actions";
import type { ConfigurationCopy } from "@/i18n/configuration/types";
import { Rich } from "@/i18n/rich";
import { useCopy } from "@/i18n/use-copy";
import type { CommandState, SkillState } from "@/lib/types";
import { Button } from "./button";
import { type CommandInstall, commandRowState, type CommandRowState, InstallCommand, readCommandInstall } from "./desktop";
import { Group, Note, Panel, QUIET_BTN, Row, Status } from "./settings";

/** The **Setup** group. It reads its own state when it first draws — the board's poll never
 *  carries it, since the command check spawns a process. */
export function SetupGroup() {
  const c = useCopy().configuration.skill;
  const caption = useCopy().configuration.general.setup;
  const [skill, setSkill] = useState<SkillState | null>(null);
  // The last write into the project failed — on open, on a check, or on the button.
  const [failed, setFailed] = useState(false);
  const [command, setCommand] = useState<CommandState | null>(null);
  const [checking, setChecking] = useState(true);
  const [installing, setInstalling] = useState(false);
  // Where the app's own `akb` stands. Null in a browser and on Linux.
  const [appCommand, setAppCommand] = useState<CommandInstall | null>(null);
  // What the app's button last found. It sits under the rows because the row has no width.
  const [commandNote, setCommandNote] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setChecking(true);
    try {
      const [res, install] = await Promise.all([skillStateAction(), readCommandInstall()]);
      setSkill(res.skill);
      setFailed(res.failed);
      setCommand(res.command);
      setAppCommand(install);
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
    try {
      const res = await installSkillAction();
      if (res.state.folders.length) setSkill(res.state);
      setFailed(!res.ok);
    } catch {
      setFailed(true);
    } finally {
      setInstalling(false);
    }
  };

  // Nothing to say until the first check is back, so the group never flashes in.
  if (!skill) return null;

  const skillNeedsWork =
    failed ||
    (skill.folders.length > 0 &&
      (!skill.installed || skill.outdated || skill.folders.some((folder) => folder.state === "absent")));
  // In the app, the row answers out of the app's own state; everywhere else out of the `akb`
  // the board found on the PATH. Rules too old to say leave it out.
  const row = commandRowState(appCommand);
  const commandNeedsWork = row ? row !== "ready" : !!command?.behind;
  const note = appNote(row, appCommand, c);

  if (!skillNeedsWork && !commandNeedsWork && !commandNote) return null;

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
          {skillNeedsWork && (
            <Row label={c.skillRow}>
              <Status ready={false}>{skillStatus(skill, c)}</Status>
              <Button size="sm" disabled={installing || !skill.folders.length} onClick={() => void install()}>
                {installing ? c.writing : buttonLabel(skill, c)}
              </Button>
            </Row>
          )}

          {(commandNeedsWork || commandNote) && (
            <Row label={c.commandRow}>
              <Status ready={!commandNeedsWork}>{commandStatus(row, command, c)}</Status>
              {/* The desktop app can point the PATH at the copy it carries. Elsewhere this
                  draws nothing and the line to type below is the answer. */}
              <InstallCommand
                install={appCommand}
                onDone={(state, ok) => {
                  setAppCommand(state);
                  if (ok) void load();
                }}
                onNote={setCommandNote}
              />
            </Row>
          )}
        </div>
      </Panel>

      {skillNeedsWork && failed && <Note icon={<FiAlertCircle />}>{c.notWritten}</Note>}

      {note && (
        <Note icon={<FiAlertCircle />}>
          <Rich>{note}</Rich>
        </Note>
      )}

      {commandNote && (
        <Note icon={commandNote.ok ? <FiCheck className="text-nb-mint-ink" /> : <FiAlertCircle />}>
          <Rich>{commandNote.text}</Rich>
        </Note>
      )}

      {/* A browser tab or Linux: the line that fixes an `akb` this board can't reach. */}
      {!row && command?.behind && <CommandLine line={command.line} copy={c} />}
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

function commandStatus(row: CommandRowState | null, command: CommandState | null, c: SkillCopy): string {
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
