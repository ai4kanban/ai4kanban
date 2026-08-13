// How a move talks back, and how it refuses.
//
// A refused move throws a BoardError instead of ending the process: the same code has to
// answer a terminal, the CLI, and (through the CLI) a UI holding a run open, and none of
// those can be killed by a bad answer. The one entry point that owns the process — the
// dispatcher in board-cli.ts — is where a refusal turns into a message and an exit code.
//
// Every line a move prints goes through `say`, so the dispatcher can hold the prose aside
// and answer in JSON instead. Imported by paths.ts, so it imports nothing of ours.

// What a refusal knows beyond its message: `kind`, `bare`, and whatever facts the move
// had at hand (an id, a track, a folder), which land in `details`.
export interface BoardErrorOptions {
  kind?: string
  bare?: boolean
  [detail: string]: unknown
}

export class BoardError extends Error {
  // `kind` is the machine-readable name of the refusal (card-not-found, no-board,
  // unknown-track, …). It is what a caller reads; the exit code stays 1 for every
  // refusal, so nobody has to keep a table of numbers.
  kind: string
  // `bare` says the message is already the whole thing a person should see — a usage
  // block, say — so the dispatcher prints it without putting the command in front of it.
  bare: boolean
  details: Record<string, unknown>

  constructor(message: string, { kind = 'refused', bare = false, ...details }: BoardErrorOptions = {}) {
    super(message)
    this.name = 'BoardError'
    this.kind = kind
    this.bare = bare
    this.details = details
  }
}

// Where a move's prose lands while `--json` holds it aside.
export interface Sink {
  out: string[]
  warnings: string[]
}

// The current sink. null means "straight to the console" — the terminal case.
let sink: Sink | null = null

// Hold everything printed from here on instead of writing it out, and hand back the box
// it lands in. Used by --json, where the prose is one field of the answer rather than the
// answer itself. The box fills as the move runs, so a move that refuses halfway still has
// everything it said up to that point.
export function startCollecting(): Sink {
  sink = { out: [], warnings: [] }
  return sink
}

export function stopCollecting(): void {
  sink = null
}

// Run `fn` with everything it prints held aside and thrown away. For the board moves a run
// makes on its own — putting a card's stage back, stamping a recurring run — whose prose
// is nobody's answer: the command that triggered them is answering something else, and its
// stdout has to stay its own. Restores whatever was collecting before, so it nests.
export function quietly<T>(fn: () => T): T {
  const before = sink
  sink = { out: [], warnings: [] }
  try {
    return fn()
  } finally {
    sink = before
  }
}

// One line of a move's prose answer.
export function say(line: unknown = ''): void {
  const text = String(line)
  if (sink) sink.out.push(...text.split('\n'))
  else console.log(text)
}

// Something worth saying that isn't the answer. Straight to stderr when nobody is
// collecting, so a move's stdout (e.g. `create`'s id) stays clean for whoever piped it.
export function warn(message: unknown): void {
  if (sink) sink.warnings.push(String(message))
  else console.error(`kanban: warning — ${message}`)
}
