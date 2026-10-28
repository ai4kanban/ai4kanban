// The live tail a talking connector writes, and the closing message it hands back.
//
// The log this writes reads like every other agent's: the agent's words as prose, one
// `⏺ line` per tool call, and `[error]` in front of anything that went wrong. Thinking is
// marked, because unmarked it reads as the answer.
//
// The printing connectors have no use for this — their renderers are handed whole events
// and return whole lines. A conversation arrives in pieces instead, so something has to
// hold the half-written message: that is what `said` is, and the last one finished is the
// run's result.

export type Tail = ReturnType<typeof createTail>

export function createTail(log: (text: string) => void) {
  let mode: 'none' | 'text' | 'thought' = 'none'
  let said = '' // the message being written right now — the last one is the run's result
  let final: string | undefined

  const close = () => {
    if (mode === 'none') return
    if (mode === 'text' && said.trim()) final = said.trim()
    said = ''
    mode = 'none'
    log('\n\n')
  }

  return {
    /** A piece of the agent's answer, as it is written. */
    text(chunk: string) {
      if (!chunk) return
      if (mode !== 'text') {
        close()
        mode = 'text'
      }
      said += chunk
      log(chunk)
    },
    /** A piece of the agent's thinking. */
    thought(chunk: string) {
      if (!chunk) return
      if (mode !== 'thought') {
        close()
        mode = 'thought'
        log('💭 ')
      }
      log(chunk)
    },
    /** One line about something that isn't the agent talking. */
    line(text: string) {
      close()
      log(`${text}\n`)
    },
    /** End of the turn: whatever is half-written is finished off. */
    end(): string | undefined {
      close()
      return final
    },
  }
}
