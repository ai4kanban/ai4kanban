// The inbox (#453, #499).
//
// The halves that have to agree: what the endpoint sends becomes a file, the same thing sent
// twice becomes one file, something ignored never comes back, and what is dropped or pasted
// in by hand lands as the same kind of file. The fetch is driven against a stubbed `fetch`,
// so these fix the shape of the request and the answers to a refusal without a network.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { setBoardRoot } from '../src/lib/paths.ts'
import { addToInbox } from '../src/lib/signals/add.ts'
import { signalConfigGaps } from '../src/lib/signals/config.ts'
import { fetchSignals } from '../src/lib/signals/fetch.ts'
import { readHandled } from '../src/lib/signals/inbox.ts'
import { dismissSignal, readSignals } from '../src/lib/signals/index.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-signals-'))
const kanban = () => path.join(root, 'docs', 'kanban')
const inbox = () => path.join(kanban(), 'triage', 'inbox')

const ENDPOINT = 'https://signals.example.test/pull'

/** One item as an endpoint sends it. */
const wire = (id: string, extra: Record<string, unknown> = {}) => ({
  source_id: id,
  title: `Signal ${id}`,
  summary: 'What somebody said, in their own words.',
  source: 'Reddit',
  url: `https://reddit.example.test/${id}`,
  collected_at: '2026-09-06T21:40:00Z',
  ...extra,
})

/** A dropped file, the way the page hands one over. */
const dropped = (name: string, body: string, type = '') => ({
  file: { name, type, data: new TextEncoder().encode(body) },
})

/** Answer the next fetch with this body, and remember what it was asked. */
let asked: { url: string; init: RequestInit | undefined } | null = null
function answerWith(body: unknown, status = 200): void {
  asked = null
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    asked = { url: String(url), init }
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response
  }) as typeof fetch
}

const realFetch = globalThis.fetch

function configure({ endpoint = true, token = true }: { endpoint?: boolean; token?: boolean } = {}): void {
  fs.writeFileSync(
    path.join(kanban(), 'config.md'),
    `# Configuration\n\n- **Project** — A board.\n${endpoint ? `- **Signal endpoint** — ${ENDPOINT}\n` : ''}`,
  )
  if (token) fs.writeFileSync(path.join(kanban(), '.env'), 'SIGNAL_ENDPOINT_TOKEN=a-secret\n')
  else fs.rmSync(path.join(kanban(), '.env'), { force: true })
}

beforeEach(() => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  fs.mkdirSync(path.join(kanban(), 'todo'), { recursive: true })
  fs.writeFileSync(path.join(kanban(), 'next-id'), '90\n')
  setBoardRoot(root)
  configure()
})

after(() => {
  globalThis.fetch = realFetch
  fs.rmSync(root, { recursive: true, force: true })
})

describe('what a pull writes', () => {
  it('sends the token as a bearer and writes one file per signal', async () => {
    answerWith({ signals: [wire('a1'), wire('a2')] })
    const report = await fetchSignals()

    assert.equal(report.added.length, 2)
    assert.equal(asked!.url, ENDPOINT)
    assert.equal((asked!.init!.headers as Record<string, string>).authorization, 'Bearer a-secret')
    assert.equal(fs.readdirSync(inbox()).length, 2)

    const inboxNow = readSignals()
    assert.equal(inboxNow.relPath, 'docs/kanban/triage/inbox')
    assert.equal(inboxNow.signals.length, 2)
    const [first] = inboxNow.signals
    assert.equal(first!.title, 'Signal a1')
    assert.equal(first!.source, 'Reddit')
    assert.equal(first!.summary, 'What somebody said, in their own words.')
    assert.match(first!.collectedAt, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
    assert.equal(inboxNow.latestImport, first!.importedAt)
  })

  it('makes the folder on the first pull and not before', async () => {
    assert.equal(fs.existsSync(inbox()), false)
    assert.deepEqual(readSignals().signals, [])
    answerWith({ signals: [wire('a1')] })
    await fetchSignals()
    assert.equal(fs.existsSync(inbox()), true)
  })

  it('sorts newest collected first', async () => {
    answerWith({
      signals: [
        wire('older', { collected_at: '2026-09-01T08:00:00Z' }),
        wire('newer', { collected_at: '2026-09-05T08:00:00Z' }),
      ],
    })
    await fetchSignals()
    assert.deepEqual(
      readSignals().signals.map((s) => s.sourceId),
      ['newer', 'older'],
    )
  })
})

describe('the same signal twice', () => {
  it('is skipped on a second pull', async () => {
    answerWith({ signals: [wire('a1')] })
    await fetchSignals()
    answerWith({ signals: [wire('a1'), wire('a2')] })
    const again = await fetchSignals()
    assert.equal(again.added.length, 1)
    assert.equal(again.skipped, 1)
    assert.equal(readSignals().signals.length, 2)
  })

  it('is skipped inside one batch', async () => {
    answerWith({ signals: [wire('a1'), wire('a1')] })
    const report = await fetchSignals()
    assert.equal(report.added.length, 1)
    assert.equal(report.skipped, 1)
  })
})

describe('what the endpoint may leave out (#499)', () => {
  it('takes an item with only a title and a body', async () => {
    answerWith({ signals: [{ title: 'A newsletter issue', summary: 'What it said.' }] })
    const report = await fetchSignals()
    assert.equal(report.added.length, 1)
    const [only] = readSignals().signals
    assert.equal(only!.source, '')
    assert.equal(only!.url, '')
    assert.match(only!.sourceId, /^derived-[0-9a-f]{16}$/)
    assert.match(only!.collectedAt, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
  })

  it('derives the same id for the same item twice, so it lands once', async () => {
    answerWith({ signals: [{ title: 'Same', summary: 'Words.' }] })
    await fetchSignals()
    answerWith({ signals: [{ title: 'Same', summary: 'Words.' }] })
    assert.equal((await fetchSignals()).skipped, 1)
  })

  it('names the site as the source when nothing else does', async () => {
    answerWith({ signals: [{ title: 'A post', summary: 'Words.', url: 'https://www.example.test/a/b' }] })
    await fetchSignals()
    assert.equal(readSignals().signals[0]!.source, 'example.test')
  })

  it('still reads `platform` from an endpoint written before the rename', async () => {
    answerWith({ signals: [{ title: 'A post', summary: 'Words.', platform: 'Zhihu' }] })
    await fetchSignals()
    assert.equal(readSignals().signals[0]!.source, 'Zhihu')
  })

  it('refuses one with no words in it, and the rest of the batch still lands', async () => {
    answerWith({ signals: [wire('good'), { ...wire('bad'), title: '', summary: '  ' }, wire('alsoGood')] })
    const report = await fetchSignals()
    assert.equal(report.added.length, 2)
    assert.deepEqual(report.failed, [{ which: 'bad', why: 'missing title, summary' }])
    assert.equal(readSignals().signals.length, 2)
  })

  it('is named by its place when it carries no source id', async () => {
    answerWith({ signals: [{ summary: 'Nothing else' }] })
    const report = await fetchSignals()
    assert.equal(report.failed[0]!.which, 'signal 1')
  })

  it('is refused when its collected time is not a time', async () => {
    answerWith({ signals: [wire('a1', { collected_at: 'whenever' })] })
    const report = await fetchSignals()
    assert.equal(report.added.length, 0)
    assert.match(report.failed[0]!.why, /collected_at is not a time/)
  })
})

describe('a pull that fails', () => {
  it('writes nothing when the request is refused', async () => {
    answerWith({ signals: [wire('a1')] }, 401)
    await assert.rejects(fetchSignals(), /answered 401/)
    assert.equal(fs.existsSync(inbox()), false)
  })

  it('writes nothing when the answer carries no signals list', async () => {
    answerWith({ items: [] })
    await assert.rejects(fetchSignals(), /`signals` list/)
    assert.equal(fs.existsSync(inbox()), false)
  })

  it('names what is missing before it asks anything', async () => {
    configure({ endpoint: false, token: false })
    assert.deepEqual(
      signalConfigGaps().map((gap) => gap.what),
      ['endpoint', 'token'],
    )
    answerWith({ signals: [wire('a1')] })
    await assert.rejects(fetchSignals(), /not set up to pull signals/)
    assert.equal(asked, null)
  })

  it('reads a placeholder endpoint as no endpoint at all', () => {
    fs.writeFileSync(path.join(kanban(), 'config.md'), '# Configuration\n\n- **Signal endpoint** — <url>\n')
    assert.deepEqual(
      signalConfigGaps().map((gap) => gap.what),
      ['endpoint'],
    )
  })
})

describe('ignoring a signal', () => {
  it('takes the file away and keeps it away', async () => {
    answerWith({ signals: [wire('a1'), wire('a2')] })
    await fetchSignals()

    assert.deepEqual(dismissSignal('a1'), { ok: true })
    assert.deepEqual(
      readSignals().signals.map((s) => s.sourceId),
      ['a2'],
    )
    assert.equal(readHandled().has('a1'), true)

    answerWith({ signals: [wire('a1'), wire('a2')] })
    const again = await fetchSignals()
    assert.equal(again.added.length, 0)
    assert.equal(again.skipped, 2)
    assert.deepEqual(
      readSignals().signals.map((s) => s.sourceId),
      ['a2'],
    )
  })

  it('keeps the record when the signal file is deleted by hand', async () => {
    answerWith({ signals: [wire('a1')] })
    await fetchSignals()
    dismissSignal('a1')
    fs.rmSync(path.join(kanban(), 'triage', 'handled.md'))
    // Without the record the signal comes back — which is the whole reason the record is a
    // file of its own rather than the inbox.
    answerWith({ signals: [wire('a1')] })
    assert.equal((await fetchSignals()).added.length, 1)
  })

  it('refuses an id the inbox does not hold', () => {
    assert.equal(dismissSignal('nobody').ok, false)
    assert.equal(dismissSignal('').ok, false)
  })
})

describe('adding to the inbox by hand (#499)', () => {
  it('takes a pasted link, named by where it points', () => {
    const done = addToInbox({ text: '  https://www.example.test/blog/why-x  ' })
    assert.equal(done.ok, true)
    const [only] = readSignals().signals
    assert.equal(only!.title, 'example.test/blog/why-x')
    assert.equal(only!.source, 'example.test')
    assert.equal(only!.url, 'https://www.example.test/blog/why-x')
  })

  it('takes pasted text, titled by its first line', () => {
    assert.equal(addToInbox({ text: 'Their pricing changed\n\nThe cheap tier is gone.' }).ok, true)
    const [only] = readSignals().signals
    assert.equal(only!.title, 'Their pricing changed')
    assert.match(only!.summary, /The cheap tier is gone\./)
    assert.equal(only!.url, '')
  })

  it('reads a dropped text file as the body, and names the file as the source', () => {
    assert.equal(addToInbox(dropped('issue-42.md', '# Newsletter 42\n\nWhat it said.')).ok, true)
    const [only] = readSignals().signals
    assert.equal(only!.title, 'Newsletter 42')
    assert.equal(only!.source, 'issue-42.md')
    assert.match(only!.summary, /What it said\./)
    assert.equal(fs.existsSync(path.join(inbox(), 'files')), false)
  })

  it('copies a file it cannot read into the board, and the body says where', () => {
    const pdf = { file: { name: 'q3.pdf', type: 'application/pdf', data: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x00, 0xff]) } }
    assert.equal(addToInbox(pdf).ok, true)
    const [only] = readSignals().signals
    assert.equal(only!.title, 'q3')
    assert.equal(only!.source, 'q3.pdf')
    assert.match(only!.summary, /docs\/kanban\/triage\/inbox\/files\/q3-[0-9a-f]{8}\.pdf/)
    assert.equal(fs.readdirSync(path.join(inbox(), 'files')).length, 1)
    // The copy is beside the inbox, not in it: the list still holds one item.
    assert.equal(readSignals().signals.length, 1)
  })

  it('leaves no copy behind when it refuses a file the inbox already holds', () => {
    const pdf = () => ({ file: { name: 'q3.pdf', type: 'application/pdf', data: new Uint8Array([0x25, 0x50, 0x44, 0x46]) } })
    assert.equal(addToInbox(pdf()).ok, true)
    const kept = fs.readdirSync(path.join(inbox(), 'files'))
    assert.equal(addToInbox(pdf()).ok, false)
    assert.deepEqual(fs.readdirSync(path.join(inbox(), 'files')), kept)
    assert.equal(readSignals().signals.length, 1)
  })

  it('refuses the same thing twice, and refuses an empty add', () => {
    assert.equal(addToInbox({ text: 'https://example.test/a' }).ok, true)
    const again = addToInbox({ text: 'https://example.test/a' })
    assert.equal(again.ok, false)
    assert.match(again.ok ? '' : again.error, /already in the inbox/)
    assert.equal(addToInbox({ text: '   ' }).ok, false)
    assert.equal(addToInbox({}).ok, false)
  })

  it('writes the same kind of file the pull writes, so it dismisses the same way', () => {
    const done = addToInbox({ text: 'A thing worth doing\n\nBecause of this.' })
    assert.equal(done.ok, true)
    const id = readSignals().signals[0]!.sourceId
    assert.deepEqual(dismissSignal(id), { ok: true })
    assert.deepEqual(readSignals().signals, [])
    assert.equal(readHandled().has(id), true)
  })
})
