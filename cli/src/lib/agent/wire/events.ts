// A run's structured events (#2059), named after ACP's session updates so every runtime
// reports in one shape: ACP agents hand theirs over as-is, Claude Code and Codex map onto it.
// Messages arrive whole — chunks are held until a tool call, a plan or the turn's end.

import { obj, str, type Json } from './json'

export const EVENT_KINDS = ['message', 'tool_call', 'tool_call_update', 'plan', 'error', 'log', 'context'] as const
export type EventKind = (typeof EVENT_KINDS)[number]

export const TOOL_KINDS = ['read', 'edit', 'delete', 'move', 'search', 'execute', 'fetch', 'other'] as const
export type ToolKind = (typeof TOOL_KINDS)[number]

export interface PlanEntry {
  content: string
  status: string
  priority?: string
}

export type RunEvent =
  | { kind: 'message'; data: { text: string } }
  | { kind: 'tool_call'; data: { toolCallId: string; title: string; kind: ToolKind; status: string; target?: string } }
  | { kind: 'tool_call_update'; data: { toolCallId: string; status: string; result?: string } }
  | { kind: 'plan'; data: { entries: PlanEntry[] } }
  | { kind: 'error'; data: { text: string } }
  | { kind: 'log'; data: { text: string } }
  | { kind: 'context'; data: { used: number; limit: number } }

export type EventCollector = ReturnType<typeof createEventCollector>

const toolKind = (v: unknown): ToolKind => (TOOL_KINDS as readonly string[]).includes(str(v)) ? (v as ToolKind) : 'other'

/** One line, bounded — what a tool call was called on. */
export function targetOf(raw: string): string | undefined {
  const line = raw.split('\n')[0]!.trim()
  if (!line) return undefined
  return line.length > 160 ? `${line.slice(0, 159)}…` : line
}

/** The text of a tool call's ACP `content`: text blocks and diffs, in order. */
function contentText(raw: unknown): string {
  const parts = Array.isArray(raw) ? raw : []
  return parts
    .map((p) => {
      const part = obj(p)
      if (part.type === 'diff') return str(part.path)
      return str(obj(part.content).text) || str(part.text)
    })
    .filter((t) => t.trim())
    .join('\n')
}

// Each agent's own words for a todo's state (Cursor's `TODO_STATUS_IN_PROGRESS`, `done`),
// in ACP's three.
function statusOf(raw: unknown): string {
  const s = str(raw).toLowerCase()
  if (s.includes('progress')) return 'in_progress'
  if (/complete|done|cancel/.test(s)) return 'completed'
  return 'pending'
}

function entriesOf(raw: unknown): PlanEntry[] {
  return (Array.isArray(raw) ? raw : []).map(obj).flatMap((e) => {
    const content = str(e.content).trim()
    if (!content) return []
    return [{ content, status: statusOf(e.status), ...(str(e.priority) ? { priority: str(e.priority) } : {}) }]
  })
}

// A plan written as a tool call — OpenCode's `todowrite`, Cursor's "Update TODOs". It reports as
// the plan, never as a tool call of its own.
const isTodoCall = (u: Json) => str(u.title) === 'todowrite' || str(obj(u.rawInput)._toolName) === 'updateTodos'

const inputTarget = (input: Json) => str(input.command) || str(input.path) || str(input.filePath)

const targetIn = (u: Json): string | undefined => {
  const locations = Array.isArray(u.locations) ? u.locations : []
  return targetOf(inputTarget(obj(u.rawInput)) || str(obj(locations[0]).path) || '')
}

export function createEventCollector() {
  let queue: RunEvent[] = []
  let said = ''
  const todoCalls = new Set<string>()
  // A call whose input names nothing yet (OpenCode's, Cursor's edits), until its first update
  // says what it is on — OpenCode opens a command with only its working folder.
  const held = new Map<string, Extract<RunEvent, { kind: 'tool_call' }>['data']>()
  let todos: (PlanEntry & { id: string })[] = []

  const close = () => {
    if (said.trim()) queue.push({ kind: 'message', data: { text: said.trim() } })
    said = ''
  }
  const release = (id: string, target?: string) => {
    const call = held.get(id)
    if (!call) return
    held.delete(id)
    queue.push({ kind: 'tool_call', data: { ...call, ...(target ? { target } : {}) } })
  }

  return {
    /** One ACP `session/update`'s `update`. Thoughts and housekeeping updates yield nothing. */
    update(raw: unknown): void {
      const u = obj(raw)
      if (u.sessionUpdate === 'agent_message_chunk') {
        said += str(obj(u.content).text)
        return
      }
      // A thought or a housekeeping update between two chunks doesn't end the message.
      if (!['tool_call', 'tool_call_update', 'plan'].includes(str(u.sessionUpdate))) return
      close()
      switch (u.sessionUpdate) {
        case 'tool_call': {
          const id = str(u.toolCallId)
          if (isTodoCall(u)) {
            todoCalls.add(id)
            return
          }
          const target = targetIn(u)
          const data = { toolCallId: id, title: str(u.title) || 'tool', kind: toolKind(u.kind), status: str(u.status) || 'pending', ...(target ? { target } : {}) }
          if (u.rawInput !== undefined && !inputTarget(obj(u.rawInput))) held.set(id, data)
          else queue.push({ kind: 'tool_call', data })
          return
        }
        case 'tool_call_update': {
          const id = str(u.toolCallId)
          if (todoCalls.has(id)) {
            // OpenCode's whole list rides on the call's input; Cursor's arrives as its own request.
            const list = obj(u.rawInput).todos
            if (Array.isArray(list) && !str(obj(u.rawInput)._toolName)) queue.push({ kind: 'plan', data: { entries: entriesOf(list) } })
            return
          }
          release(id, targetIn(u))
          const result = contentText(u.content)
          // Progress with nothing new to say is not an event.
          if (!u.status && !result) return
          queue.push({
            kind: 'tool_call_update',
            data: { toolCallId: str(u.toolCallId), status: str(u.status) || 'in_progress', ...(result ? { result } : {}) },
          })
          return
        }
        case 'plan':
          queue.push({ kind: 'plan', data: { entries: entriesOf(u.entries) } })
          return
      }
    },
    /** A whole message, for a source that never sends one in pieces. */
    message(text: string): void {
      close()
      if (text.trim()) queue.push({ kind: 'message', data: { text: text.trim() } })
    },
    toolCall(toolCallId: string, title: string, kind: ToolKind, target?: string): void {
      close()
      const t = target ? targetOf(target) : undefined
      queue.push({ kind: 'tool_call', data: { toolCallId, title, kind, status: 'in_progress', ...(t ? { target: t } : {}) } })
    },
    toolResult(toolCallId: string, status: 'completed' | 'failed', result: string): void {
      close()
      queue.push({ kind: 'tool_call_update', data: { toolCallId, status, ...(result.trim() ? { result: result.trim() } : {}) } })
    },
    plan(entries: unknown): void {
      close()
      queue.push({ kind: 'plan', data: { entries: entriesOf(entries) } })
    },
    /** Cursor's `cursor/update_todos`: the whole list, or under `merge` only what changed, by id. */
    todos(raw: unknown, merge: boolean): void {
      close()
      const items = (Array.isArray(raw) ? raw : []).map(obj).flatMap((e) => {
        const [entry] = entriesOf([e])
        return entry ? [{ ...entry, id: str(e.id) }] : []
      })
      const next = merge ? [...todos] : []
      for (const item of items) {
        const at = item.id ? next.findIndex((t) => t.id === item.id) : -1
        if (at >= 0) next[at] = item
        else next.push(item)
      }
      todos = next
      queue.push({ kind: 'plan', data: { entries: todos.map(({ id: _, ...e }) => e) } })
    },
    log(text: string): void {
      close()
      if (text.trim()) queue.push({ kind: 'log', data: { text } })
    },
    error(text: string): void {
      close()
      if (text.trim()) queue.push({ kind: 'error', data: { text: text.trim() } })
    },
    /** The turn is over: a half-held message is finished off. */
    end(): void {
      close()
      for (const id of [...held.keys()]) release(id)
    },
    /** What arrived since the last call. */
    events(): RunEvent[] {
      const out = queue
      queue = []
      return out
    },
  }
}

/** An event read back from a file or a wire, or undefined when it is not one. */
export function asEvent(value: unknown): RunEvent | undefined {
  const e = obj(value)
  if (!(EVENT_KINDS as readonly string[]).includes(str(e.kind))) return undefined
  if (!e.data || typeof e.data !== 'object' || Array.isArray(e.data)) return undefined
  return e as unknown as RunEvent
}
