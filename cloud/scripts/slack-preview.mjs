#!/usr/bin/env node
// Every kind of Slack message this service posts, drawn from the events it actually holds.
//
//   npm run preview:slack
//
// One read of cloud.events, one sample per shape a message renders differently — the state,
// the kind, how many questions it carries and whether they have options, and whether the
// card sent its opening paragraph and its review notes. The newest event of each shape wins.
// Nothing is invented: the words in these files are the ones a channel is being shown.
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

import { answerView, messageFor } from '../src/slack-message.ts'
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
    const name = unique(nameFor(event), taken)
    written.push(save(name, describe(event), { blocks: messageFor(event).blocks }))
  }

  // The modal the Answer button opens, off whichever real event asks the most.
  const asked = rows
    .map((row) => row.event)
    .filter((event) => event.decision === 'answer')
    .sort((a, b) => b.questions.length - a.questions.length)[0]
  if (asked) {
    const view = answerView(asked)
    written.push(save('answer-modal', `The Answer modal — ${title(asked)}`, { blocks: view.blocks }))
    writeFileSync(join(OUT, 'answer-modal.view.json'), `${JSON.stringify(view, null, 2)}\n`)
  }

  // A state no event has reached yet is still a message this service posts. It is drawn off
  // a real settled event with the state field replaced and nothing else, so the words are a
  // real card's — and the name says the state is the one part that is not.
  const held = new Set((await query(ref, token, STATES)).map((row) => row.state))
  const missing = ALL_STATES.filter((state) => !held.has(state))
  const settled = rows.map((row) => row.event).find((event) => event.acted && event.summary)
  const stood = settled ? missing : []
  for (const state of stood) {
    const event = { ...settled, state }
    written.push(
      save(`unseen-${state.replace(/_/g, '-')}`, `${describe(event)} — real card, state substituted`, {
        blocks: messageFor(event).blocks,
      }),
    )
  }

  console.log(`${written.length} messages in ${relative(process.cwd(), OUT)}/\n`)
  for (const { name, what, link } of written) console.log(`${name}\n  ${what}\n  ${link}\n`)
  if (asked) console.log('answer-modal.view.json is the whole view — paste it with the builder on Modal.\n')
  if (missing.length > 0) {
    console.log(
      stood.length > 0
        ? `No event has reached ${missing.join(', ')} yet. The unseen-* samples put those states on ${title(settled)}, whose words are real.`
        : `No event has reached ${missing.join(', ')} yet, and no settled event was found to stand in for one.`,
    )
  }
}

/** The nine states an event can be in, as migrations/0004_events.sql checks them, plus the
 *  one cloud.event_json computes. A state no event has reached is not drawn from a made-up
 *  row — it is reported as missing. */
const ALL_STATES = [
  'actionable',
  'accepted',
  'waiting_for_server',
  'running',
  'completed',
  'failed',
  'cancelled',
  'interrupted',
  'stale',
]

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
