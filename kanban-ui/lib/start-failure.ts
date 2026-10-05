import type { UiCopy } from "@/i18n/types";
import type { RefusalArgs, RunReason, RunRefusal, RunRefusalKind } from "./format/agent/types";

// --- a refusal, in the user's language (#706, #955) ------------------------------
//
// The board refuses in its own English, with the kind behind the sentence. The server says it
// in the language the app is set to HERE — the one place a refusal is translated — keeping the
// names, paths and commands it carries as they are. A refusal with no kind is the board's raw
// sentence: the screen says its own one-line summary and lists the raw sentence under it,
// since a sentence that guesses is worse than one that admits it knows nothing.

/** Every refusal the copy has a sentence for: the board's kinds, and the few the app answers
 *  with itself. */
export type RefusalKind = RunRefusalKind | "noProcess" | "noPlan" | "planHanded" | "rules";

/** Anything that failed, as a server action hands it to the screen. `raw` marks an `error`
 *  that is the board's own English, not yet said in the user's language. */
export interface Refused {
  error?: string;
  reason?: string;
  args?: RefusalArgs;
  /** The files a `dirty` refusal named. */
  paths?: string[];
  raw?: boolean;
}

/** The refusal in the reader's language, or undefined when the copy has no sentence for it. */
export function refusalLine(r: Refused, t: UiCopy): string | undefined {
  const say = r.reason ? (t.messages.refusal as Record<string, ((a: RefusalArgs) => string) | undefined>)[r.reason] : undefined;
  if (!say) return undefined;
  const a = r.args ?? {};
  const action = a.action;
  const stage = (s?: string) => (s ? t.configuration.workflows.stages[s as "plan"] ?? s : "");
  const builtIn = a.workflow ? (t.configuration.workflows.builtInNames as Record<string, string>)[a.workflow] : undefined;
  const word = (words: Partial<Record<string, string>>, key: string) => words[key];
  return say({
    ...a,
    ...(action ? { verb: word(t.runs.verb, action) ?? action, act: word(t.runs.action, action) ?? word(t.chips.schedule.action, action) ?? action } : {}),
    ...(a.stage ? { stage: stage(a.stage) } : {}),
    ...(a.assigned ? { assigned: stage(a.assigned) } : {}),
    ...(builtIn && a.name ? { name: builtIn } : {}),
    ...("task" in a ? { task: a.task ? `#${a.task}` : t.messages.theBuild } : {}),
  });
}

/** A failure as the screen draws it: one line, and what goes under it — the paths a refusal
 *  named, or the raw sentence the line summarises. */
export interface StartFailure {
  line: string;
  paths: string[];
}

/** What to say about something that failed. `fallback` is the screen's own line for this
 *  action, said when the answer carries nothing the reader can read — no error, or a raw one. */
export function failure(res: Refused, fallback: string): StartFailure {
  if (!res.error) return { line: fallback, paths: res.paths ?? [] };
  if (res.raw) return { line: fallback, paths: [res.error] };
  return { line: res.error, paths: res.paths ?? [] };
}

/** The same, as one string — for the places with no room to lay the lines out. */
export const failureText = (failure: StartFailure): string => [failure.line, ...failure.paths].join("\n");

/** One call for a screen that shows a failure as text. */
export const sayFailure = (res: Refused, fallback: string): string => failureText(failure(res, fallback));

/** A start that did not start. A result that came back ok with no run id is a start that did
 *  not happen either, and reads as `other`. */
export const startFailure = (res: Refused, c: { other: string }): StartFailure => failure(res, c.other);

// --- how a run ended, in the user's language (#1241) -----------------------------
//
// The board writes a run's `error` and `note` in English and keeps each part's kind beside
// them. A part with no kind, and a record older than kinds, is shown as the board wrote it.

/** One part of the board's word on a run: a sentence, and the lines it quotes as they are. */
export interface ReasonPart {
  line: string;
  lines?: string[];
}

const nested = (refusals: RunRefusal[] | undefined, t: UiCopy) =>
  (refusals ?? []).map((r) => refusalLine(r, t) ?? r.error).join(" ");

/** One part in the reader's language, or undefined when the copy has no sentence for it. */
export function reasonPart(r: RunReason, t: UiCopy): ReasonPart | undefined {
  const c = t.runs.log.reason;
  const a = r.args ?? {};
  const card = `#${a.card}`;
  switch (r.kind) {
    case "resumeUnstarted":
      return { line: c.resumeUnstarted };
    case "silent":
      return { line: c.silent(a.n ?? "") };
    case "backgroundSilent":
      return { line: c.backgroundSilent(a.n ?? "") };
    case "takenOver":
      return { line: c.takenOver };
    case "notInstalled":
      return { line: c.notInstalled(a.cmd ?? "", a.install ?? "") };
    case "format":
      return { line: c.format };
    case "repairUnstarted":
      return { line: c.repairUnstarted(nested(r.refusals, t)) };
    case "retryUnstarted":
      return { line: c.retryUnstarted(nested(r.refusals, t)) };
    case "broken": {
      const more = Number(a.more) || 0;
      return { line: c.broken(Number(a.n) || 0), lines: [...(r.lines ?? []), ...(more ? [c.brokenMore(String(more))] : [])] };
    }
    case "unsent":
      return { line: c.unsent(a.why ?? "") };
    case "qaUnfinished":
      return { line: c.qaUnfinished(card) };
    case "refineStalled":
      return { line: c.refineStalled(card) };
    case "stageShort": {
      const stage = t.configuration.workflows.stages[a.stage as "plan"] ?? a.stage ?? "";
      return { line: c.stageShort(stage, card, a.agents ?? "") };
    }
    case "specRefused":
      return { line: c.specRefused(nested(r.refusals, t)) };
    default:
      return r.text ? { line: r.text } : undefined;
  }
}

/** Why a run failed, as the board knows it — only the parts it said itself. */
export function failureReason(errorWhy: RunReason[] | undefined, t: UiCopy): string | undefined {
  const lines = (errorWhy ?? []).flatMap((r) => (r.kind ? reasonPart(r, t)?.line ?? [] : []));
  return lines.length ? lines.join(" ") : undefined;
}

/** The board's closing note, part by part; the raw note when it carries no kinds. */
export function noteParts(note: string | undefined, noteWhy: RunReason[] | undefined, t: UiCopy): ReasonPart[] {
  const parts = (noteWhy ?? []).map((r) => reasonPart(r, t));
  if (parts.length && parts.every(Boolean)) return parts as ReasonPart[];
  const raw = (note ?? "").trim();
  return raw ? [{ line: raw }] : [];
}
