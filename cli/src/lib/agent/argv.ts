// One command line, read the same way by everything that reads it.
//
// A runtime's `command` is a single string, and several places take its first word or its
// whole argv back out of it — the installed check, the login probe, and every plan a run is
// made from. Split on whitespace alone, a path holding a space becomes two arguments and
// spawns nothing, which is why a bundled path with a space in it used to be thrown away
// (#550). Windows keeps nearly everything behind one.
//
// So the split honours quotes: `"C:\Program Files\OpenAI\codex.exe" exec` is two words, not
// three. It is deliberately not a shell — no expansion, no globbing, no operators — and a
// backslash is a path separator rather than an escape, because `C:\Users\me` has to survive
// being written plainly.

/** A command line as argv. A quoted run — single or double — is one word, and a quote may
 *  open mid-word, so `--cd="a b"` stays one argument. An unclosed quote takes the rest of the
 *  line, which is the reading that spawns something rather than nothing. */
export function splitCommand(command: string): string[] {
  const argv: string[] = []
  let word = ''
  let started = false
  let quote = ''
  for (const ch of command) {
    if (quote) {
      if (ch === quote) quote = ''
      else word += ch
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      started = true
      continue
    }
    if (/\s/.test(ch)) {
      if (started) argv.push(word)
      word = ''
      started = false
      continue
    }
    word += ch
    started = true
  }
  if (started) argv.push(word)
  return argv
}

/** One argument written so `splitCommand` — and a shell — hand it back whole.
 *
 *  Double quotes, which cmd.exe and a POSIX shell both take. Nothing is escaped, because
 *  nothing here unescapes: what this is ever given is a path the board resolved, and Windows
 *  forbids a quote in one. An argument that already holds a quote is passed through as it
 *  was written, on the reading that whoever wrote it meant it. */
export function quoteArg(arg: string): string {
  return arg && !/\s/.test(arg) ? arg : `"${arg}"`
}
