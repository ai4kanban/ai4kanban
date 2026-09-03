// The plumbing every door shares, so a command only has to declare itself.
//
// Commander owns the command tree, the arguments, the options, their validation, the help
// and the "did you mean" — one declaration per command, and the help is what that
// declaration says. What is left here is the three things Commander does not do for a
// program that is also a library:
//
//   - it never ends the process. `exitOverride` turns every exit into a throw, and the
//     doors below turn that into a returned exit code — the caller may be the CLI, a board
//     UI holding a run open, or a test.
//   - everything it prints goes through `say`, so `--json` holds help and usage aside with
//     the rest of a move's prose instead of writing it into the middle of the object.
//   - `--dir` and `--json` are every command's, wherever they are typed. Commander scopes an
//     option to the command it is declared on, so they are declared on all of them and read
//     back with `optsWithGlobals`.

import { Command, CommanderError, InvalidArgumentError } from 'commander'

import { BoardError, say, startCollecting, stopCollecting, type Sink } from '../io'
import { answer, prose, report } from '../board-cli'
import { flushOnExit } from '../cloud/publish'
import { catchUpOnExit } from '../cloud/requests'

export { InvalidArgumentError }
export type { Command }

// How wide a command's own options column is before the text wraps beside it. Commander
// picks this per command; pinning it keeps every screen of help lined up as one table.
const HELP_WIDTH = 100

/** A fresh command with this project's conventions on it: no process exit, prose through
 *  `say`, a typo answered with the nearest name. */
export function newCommand(name: string): Command {
  const cmd = new Command(name)
  cmd
    .exitOverride()
    .showSuggestionAfterError(true)
    .allowExcessArguments(false)
    .configureOutput({
      // Help and usage are prose like anything else a move prints, so they go where the
      // rest of it goes — the terminal, or the box `--json` is filling.
      writeOut: (text) => say(text.replace(/\n$/, '')),
      // Commander's own error line is dropped here and rebuilt by `report` below, so a
      // refusal reads the same whichever door refused and `--json` gets one object.
      writeErr: () => {},
      outputError: () => {},
    })
    .configureHelp({ helpWidth: HELP_WIDTH, sortSubcommands: false, sortOptions: false })
  return cmd
}

/** `--dir` and `--json`, which every command takes wherever they are typed. */
export function withShared(cmd: Command): Command {
  return cmd
    .option('--dir <path>', 'the project to work on (default: the nearest board at or above this folder)')
    .option('--json', 'answer as one JSON object instead of prose')
}

/** What every command's handler is handed: the options as Commander parsed them, plus the
 *  two shared ones read from wherever they were typed. */
export interface Ctx {
  /** How the command is spelled in messages — `akb`, `akb board`, `kanban`. */
  program: string
  /** `--dir`, or null for "find the board from here". */
  dir: string | null
  /** `--json` — answer with one object rather than prose. */
  json: boolean
  /** Where the prose is held while `--json` is being built, or null. */
  box: Sink | null
}

/** Read the shared options off whichever command they were typed on. */
export function ctxOf(cmd: Command, program: string): Omit<Ctx, 'box'> {
  const opts = cmd.optsWithGlobals() as { dir?: string; json?: boolean }
  return { program, dir: opts.dir ?? null, json: opts.json === true }
}

/** What a command's handler answers with: the fields `--json` reports. */
export type Answer = Record<string, unknown> | void

/** Wrap a command's work in the shape every one of them shares: hold the prose aside when
 *  `--json` asked for it, answer, and give the board's outbox its one chance to reach Cloud
 *  before the process ends. */
export async function runAction(
  ctx: Omit<Ctx, 'box'>,
  extra: Record<string, unknown>,
  work: (ctx: Ctx) => Promise<Answer> | Answer,
): Promise<Record<string, unknown>> {
  const box = ctx.json ? startCollecting() : null
  try {
    const data = (await work({ ...ctx, box })) ?? {}
    if (ctx.json) answer({ ok: true, ...extra, ...data, ...prose(box) })
    await flushOnExit()
    await catchUpOnExit()
    return data
  } finally {
    if (ctx.json) stopCollecting()
  }
}

// ---- running one --------------------------------------------------------------------

/** Parse and run, and hand back an exit code. Never ends the process, and never lets a
 *  refusal past: the one place a thrown `BoardError` or a Commander parse error becomes the
 *  line a person reads (or the object a program does). */
export async function runProgram(program: Command, argv: string[], name: string): Promise<number> {
  // Read off the raw argv rather than the parse, so a refusal in the parse itself — an
  // unknown option, a missing argument — still answers in the form the caller asked for.
  const json = argv.includes('--json')
  try {
    await program.parseAsync(argv, { from: 'user' })
    return 0
  } catch (err) {
    if (err instanceof CommanderError) return commanderExit(err, name, json)
    // A move that refused after `runAction` closed its box: report it plainly. One that
    // refused inside the box reported through the same function with the prose attached.
    return report(err, { program: name, json })
  } finally {
    stopCollecting()
  }
}

// Commander ends a run for two reasons, and they are not the same answer. Printing help or
// a version is the command working — exit 0, nothing on stderr. Everything else is a parse
// refusal, and it is reported the way every other refusal is, with its Commander code as the
// `kind` so a caller reading `--json` can tell an unknown option from a missing argument.
function commanderExit(err: CommanderError, program: string, json: boolean): number {
  if (err.exitCode === 0) return 0
  const kind = err.code.replace(/^commander\./, '')
  return report(new BoardError(err.message.replace(/^error: /, ''), { kind }), { program, json })
}

// ---- option values ------------------------------------------------------------------

/** One of a fixed set of words, refused by name when it is something else. Commander's own
 *  `.choices()` where the value is stored as typed; this is for the places that also want
 *  the empty string as "clear it". */
export function oneOf(choices: readonly string[], { clearable = false }: { clearable?: boolean } = {}) {
  return (value: string): string => {
    if (clearable && value === '') return ''
    if (!choices.includes(value)) {
      throw new InvalidArgumentError(`must be ${choices.join(' | ')}${clearable ? ' (or "" to clear it)' : ''}.`)
    }
    return value
  }
}

/** A whole number in a range. */
export function intInRange(min: number, max: number) {
  return (value: string): number => {
    const n = Number(value)
    if (!Number.isInteger(n) || n < min || n > max) {
      throw new InvalidArgumentError(`takes a whole number from ${min} to ${max}.`)
    }
    return n
  }
}

/** A card id, as every command that names one reads it. */
export function cardId(value: string): number {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1) throw new InvalidArgumentError('takes a card id, e.g. 12.')
  return n
}

/** A repeatable option, collected in the order it was typed. */
export function collect(value: string, previous: string[] = []): string[] {
  return previous.concat([value])
}

/** A repeatable, comma-separated list — `--modules a,b --modules c` is three names. */
export function collectList(value: string, previous: string[] = []): string[] {
  return previous.concat(
    value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )
}

// ---- options that belong to the option before them -----------------------------------
//
// `--question`, and the `--option`/`--mode`/`--recommended-option` that qualify it, cannot
// each stand alone: which question a choice belongs to is the ORDER it was typed in.
// Commander runs an option's own reader as it meets it, so an accumulator shared by the
// group reads the line in the order it was written — which is the whole of what these need.

/** One flag as it was typed, in argv order. A flag that takes no value reads as `''`, and a
 *  variadic one lands as one entry per value — `--update 3 "…"` is two. */
export type Typed = [key: string, value: string]

/** Collect a group of options into one ordered list. */
export function ordered(into: Typed[]) {
  return (key: string) =>
    (value: string | null): string => {
      into.push([key, value ?? ''])
      return value ?? ''
    }
}
