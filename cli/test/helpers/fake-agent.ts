// What a stand-in agent script needs to take its prompt the way Claude Code does (#1540): the
// last argument, or the first user message on stdin when its argv asks for stream-json input.
// Paste `PROMPT_OF` into the script and `await promptOf()`.
export const PROMPT_OF = `
const promptOf = () => new Promise((done) => {
  const argv = process.argv.slice(2)
  const at = argv.indexOf('--input-format')
  if (at < 0 || argv[at + 1] !== 'stream-json') return done(argv.at(-1))
  let buf = ''
  process.stdin.on('data', (d) => {
    buf += d
    const end = buf.indexOf('\\n')
    if (end < 0) return
    process.stdin.destroy()
    done(JSON.parse(buf.slice(0, end)).message.content)
  })
});
`
