// One request/response conversation over a command's own stdin and stdout, in JSON lines.
//
// Two of the board's connectors talk rather than print, and both talk this way: a request
// is `{id, method, params}`, an answer `{id, result}` or `{id, error}`, and anything with
// a method and no id is a notification either side may send. Requests go BOTH ways — the
// agent asks us things too — so `call` is what we ask and `onCall` is what we are asked.
//
// The two dialects differ in two details and nothing else, which is what `dialect` is for:
// ACP is JSON-RPC proper and wants `jsonrpc: '2.0'` on every frame, where ZCode's server
// rejects a message that carries one; ACP mints numeric ids and ZCode string ones. Answers
// are matched on the id as text either way, so an agent that echoes `"3"` for `3` still
// finds its caller.
//
// This knows nothing about sessions, prompts or logs — that is each protocol's own file.

import type { Readable, Writable } from 'node:stream'

import { obj, str, type Json } from './json'

export interface Message {
  id?: number | string
  method?: string
  params?: Json
  result?: Json
  error?: { code?: number; message?: string }
}

export interface RpcDialect {
  /** Put `jsonrpc: '2.0'` on every outgoing frame. */
  jsonrpc?: boolean
  /** Mint request ids as strings rather than numbers. */
  stringIds?: boolean
}

export type Rpc = ReturnType<typeof connect>

export function connect(stdout: Readable, stdin: Writable, onCall: (msg: Message) => void, dialect: RpcDialect = {}) {
  let buf = ''
  let nextId = 1
  let gone: string | undefined
  const waiting = new Map<string, { ok: (result: Json) => void; fail: (err: Error) => void }>()

  const send = (msg: Json) => {
    if (gone) return
    try {
      stdin.write(`${JSON.stringify(dialect.jsonrpc ? { jsonrpc: '2.0', ...msg } : msg)}\n`)
    } catch {
      // The far end is already gone; the close below is what reports it.
    }
  }

  const closed = (why: string) => {
    if (gone) return
    gone = why
    for (const { fail } of waiting.values()) fail(new Error(why))
    waiting.clear()
  }

  stdout.on('data', (chunk: Buffer) => {
    buf += chunk.toString()
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      let msg: Message
      try {
        msg = JSON.parse(line) as Message
      } catch {
        // Not a frame. This stdout is the protocol and nothing else, so a line that isn't
        // one is a stray print — an update notice, a warning — rather than the agent
        // talking, and it is ignored rather than passed off as its words.
        continue
      }
      if (msg.method) {
        onCall(msg)
        continue
      }
      if (msg.id === undefined) continue
      const pending = waiting.get(String(msg.id))
      if (!pending) continue
      waiting.delete(String(msg.id))
      if (msg.error) pending.fail(new Error(str(msg.error.message) || `the agent refused (${msg.error.code ?? 'no code'})`))
      else pending.ok(obj(msg.result))
    }
  })
  stdout.on('close', () => closed('the agent closed the connection'))
  stdout.on('error', (err: Error) => closed(String(err)))

  return {
    /** Ask the agent something. Rejects with the agent's own words when it says no. */
    call(method: string, params: Json): Promise<Json> {
      if (gone) return Promise.reject(new Error(gone))
      const id: number | string = dialect.stringIds ? String(nextId++) : nextId++
      return new Promise<Json>((ok, fail) => {
        waiting.set(String(id), { ok, fail })
        send({ id, method, params })
      })
    },
    /** Answer something the agent asked us. */
    reply(id: number | string, result: Json) {
      send({ id, result })
    },
    /** Say we can't. Sent for anything we never offered to do, so the agent gets an answer
     *  rather than waiting on one forever. */
    refuse(id: number | string, message: string) {
      send({ id, error: { code: -32601, message } })
    },
  }
}
