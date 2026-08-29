#!/usr/bin/env node
// Every kind of Slack message this service posts, drawn from the events it actually holds.
//
//   npm run preview:slack
//
// Two sets of samples, both off one read of cloud.events. Nothing is invented: the words in
// these files are the ones a channel is being shown.
//
//   shape-*    one per shape a message renders differently — the kind, how many questions it
//              carries and whether they have options, and whether the card sent its opening
//              paragraph and its review notes. The newest event of each shape wins.
//   card-*     the CARD's own message in each state the top of a thread can show (#359).
//              An ending the board takes the card back from has none: the top is left as it
//              was, and the next event redraws it with its Implement.
//   log-*      the one-line reply that state is logged as underneath it.
//   ended-*    the extra reply those endings leave, carrying why and what to do.
//
// Together the card/log/ended trio is every transition a card's thread goes through, in the
// order it goes through them. A state no event has reached yet is drawn off a real card with
// that one field replaced, and the sample says so.
//
// Writes cloud/.slack-preview/<name>.json (out of git) and prints a Block Kit Builder link
// for each. Every file holds `{ blocks }` and nothing else, which is what the builder's
// Message surface takes — paste one in, or open the link.
//
// The read goes through the Supabase Management API, so it needs no database driver:
//   SUPABASE_PROJECT_REF    the project's 20-character ref
//   SUPABASE_ACCESS_TOKEN   a personal access token
// Both come from the environment or from cloud/.env, which is not in git.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { RESTORED } from '../src/message.ts'
import { answerView, endingFor, logFor, messageFor } from '../src/slack-message.ts'
import { loadEnv, requireEnv, serviceRoot } from './env.mjs'

const OUT = join(serviceRoot, '.slack-preview')
const BUILDER = 'https://app.slack.com/block-kit-builder/#'

/**
 * One event per shape a message renders differently, newest first.
 *
 * `cloud.event_json` is what the Worker itself renders from, so a sample is the row the
 * message was built from rather than a second reading of the same table.
 */
const SHAPES = `
with shaped as (
  select
    e.changed_at,
    e.state,
    e.kind,
    jsonb_array_length(e.questions) as questions,
    (select count(*) from jsonb_array_elements(e.questions) q where q ? 'options') as with_options,
    (select count(*) from jsonb_array_elements(e.questions) q where q->>'mode' = 'multi') as multi,
    e.summary <> '' as has_summary,
    e.notes <> '' as has_notes,
    exists (select 1 from cloud.event_actions a where a.event_id = e.id) as acted,
    cloud.event_json(e) as event
  from cloud.events e
), ranked as (
  select shaped.*, row_number() over (
    partition by state, kind, questions, with_options, multi, has_summary, has_notes, acted
    order by changed_at desc
  ) as newest
  from shaped
)
select event from ranked where newest = 1 order by state, kind, questions;
`

/** How many events one board holds per state, so the run says what it did not find. */
const STATES = `select state, count(*) as events from cloud.events group by state order by state;`

/** The account a reply names, so a sample mentions the person a press is really accepted
 *  from rather than a Slack id nobody has. */
const ACTOR = `select slack_user_id from cloud.slack_connections order by created_at limit 1;`

main().catch((error) => {
  console.error(`slack-preview: ${error.message}`)
  process.exit(1)
})

async function main() {
  const [ref, token] = requireEnv(await loadEnv(), 'SUPABASE_PROJECT_REF', 'SUPABASE_ACCESS_TOKEN')
  const rows = await query(ref, token, SHAPES)
  if (rows.length === 0) throw new Error('this account holds no events to draw')

  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT, { recursive: true })

  const taken = new Set()
  const written = []
  for (const row of rows) {
    const event = row.event
    // An ending the board takes the card back from is never drawn at the top, so there is no
    // shape of it to preview either.
    if (RESTORED.includes(event.state)) continue
    const name = unique(`shape-${nameFor(event)}`, taken)
    written.push(save(name, describe(event), { blocks: messageFor(event).blocks }))
  }

  // Every state a card's thread goes through, in the order it goes through them (#359): the
  // card's own message as that state rewrites it, the one-line reply the event is logged as
  // underneath it, and — where a delivery ended badly — the extra reply carrying why.
  const actorId = (await query(ref, token, ACTOR))[0]?.slack_user_id
  const events = rows.map((row) => row.event)
  for (const [state, what] of LIFE) {
    const event = inState(events, state)
    if (!event) continue
    const from = events.includes(event) ? title(event) : `${title(event)}, state substituted`
    const named = state.replace(/_/g, '-')
    // The top message never shows an ending the board takes the card back from, so there is
    // no card sample for one — only the thread lines it really leaves.
    if (!RESTORED.includes(state)) {
      written.push(save(`card-${named}`, `${what} — ${from}`, { blocks: messageFor(event).blocks }))
    }
    written.push(
      save(`log-${named}`, `${what}, as its line in the thread — ${from}`, {
        blocks: logFor(event, { actorId }).blocks,
      }),
    )
    if (!RESTORED.includes(state)) continue
    written.push(
      save(`ended-${named}`, `why it ended that way, in the thread — ${from}`, {
        blocks: endingFor(event).blocks,
      }),
    )
  }

  // The modal the Answer button opens, off whichever real event asks the most.
  const asked = events
    .filter((event) => event.decision === 'answer')
    .sort((a, b) => b.questions.length - a.questions.length)[0]
  if (asked) {
    const view = answerView(asked)
    written.push(save('answer-modal', `The Answer modal — ${title(asked)}`, { blocks: view.blocks }))
    writeFileSync(join(OUT, 'answer-modal.view.json'), `${JSON.stringify(view, null, 2)}\n`)
  }

  console.log(`${written.length} messages in ${relative(process.cwd(), OUT)}/\n`)
  for (const { name, what, link } of written) console.log(`${name}\n  ${what}\n  ${link}\n`)
  if (asked) console.log('answer-modal.view.json is the whole view — paste it with the builder on Modal.\n')

  const held = new Set((await query(ref, token, STATES)).map((row) => row.state))
  const missing = LIFE.map(([state]) => state).filter((state) => !held.has(state))
  if (missing.length > 0) {
    console.log(
      `No event has reached ${missing.join(', ')} yet. Those samples are a real card put into that state — with what the state machine writes beside it, and no ending's words borrowed from another card. Each one says which card.`,
    )
  }
}

/**
 * A card's life, in the order it is lived — the nine states migrations/0004_events.sql checks
 * plus the one cloud.event_json computes.
 *
 * The sentence beside each is what that state means to whoever is reading the channel, not a
 * second name for it: the names themselves are src/message.ts's, and the samples show them.
 */
const LIFE = [
  ['actionable', 'waiting for a person'],
  ['accepted', 'somebody decided it'],
  ['waiting_for_server', 'waiting for the machine that runs it'],
  ['running', 'the delivery is going'],
  ['completed', 'it landed'],
  ['failed', 'it did not land'],
  ['cancelled', 'somebody stopped it'],
  ['interrupted', 'the machine running it went away'],
  ['stale', 'the card stopped needing a person'],
]

/** The states somebody has decided by the time the message shows them. `cloud.event_json`
 *  computes `acted` off the action row, and it is what decides whether a message still offers
 *  its controls — so a substituted state has to carry the value that state really has. */
const ACTED_ON = ['accepted', 'waiting_for_server', 'running', 'completed', 'failed', 'cancelled', 'interrupted']

/**
 * A real event in this state, or a real card standing in for one.
 *
 * A state no event has reached is still a message this service posts, and a made-up card
 * would preview made-up words. So the state is substituted onto a real one — but every field
 * the state machine writes ALONGSIDE that state is written too, or the sample is a message
 * the service could never post: a card nobody decided cannot be `running`, and a `reason` is
 * the words one particular ending wrote, so a state borrowed from another card carries none.
 */
function inState(events, state) {
  const real = events.find((event) => event.state === state)
  if (real) return real
  const stand = events.find((event) => event.summary) ?? events[0]
  return stand ? { ...stand, state, acted: ACTED_ON.includes(state), reason: '' } : undefined
}

// ---- naming and saying what a sample is --------------------------------------

/** What makes this sample different from the next one, in a filename. */
function nameFor(event) {
  const questions = event.questions ?? []
  const asked = event.kind === 'question'
  return [
    event.state.replace(/_/g, '-'),
    asked ? 'question' : 'ready',
    asked ? `${questions.length}q` : null,
    asked && questions.every((q) => !q.options?.length) ? 'no-options' : null,
    asked && questions.some((q) => q.mode === 'multi') ? 'multi' : null,
    event.acted ? 'acted' : null,
    event.summary ? null : 'no-summary',
    event.notes ? null : 'no-notes',
  ]
    .filter(Boolean)
    .join('-')
}

/** The card the sample is, and the shape it stands for. */
function describe(event) {
  const questions = event.questions ?? []
  const said = [
    event.kind === 'question' ? `${questions.length} question${questions.length === 1 ? '' : 's'}` : 'ready for review',
    questions.some((q) => q.options?.length) ? 'with options' : null,
    questions.some((q) => q.mode === 'multi') ? 'one of them multi-choice' : null,
    event.summary ? null : 'no opening paragraph',
    event.notes ? null : 'no review notes',
    event.acted ? 'already acted on' : null,
  ].filter(Boolean)
  return `${title(event)} — ${said.join(', ')}`
}

const title = (event) => `#${event.taskId} ${event.taskTitle}`

function unique(name, taken) {
  let held = name
  for (let at = 2; taken.has(held); at += 1) held = `${name}-${at}`
  taken.add(held)
  return held
}

/** One sample: the file to paste and the link that draws it. */
function save(name, what, payload) {
  writeFileSync(join(OUT, `${name}.json`), `${JSON.stringify(payload, null, 2)}\n`)
  return { name, what, link: BUILDER + encodeURIComponent(JSON.stringify(payload)) }
}

// ---- the read ----------------------------------------------------------------

async function query(ref, token, sql) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const body = await response.text()
  if (!response.ok) throw new Error(`Supabase answered ${response.status}: ${body}`)
  const parsed = body ? JSON.parse(body) : []
  return Array.isArray(parsed) ? parsed : []
}
