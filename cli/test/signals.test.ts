// Triage (#453, #499, #559).
//
// The halves that have to agree: what the endpoint sends becomes a file, the same thing sent
// twice becomes one file, something ignored never comes back to a pull but can be pasted in
// again by hand, and what is dropped or pasted in lands as the same kind of file. The fetch
// is driven against a stubbed `fetch`, so these fix the shape of the request and the answers
// to a refusal without a network.
//
// The other half of #559 is the board written before it: an `inbox/` folder and a
// `handled.md` list, migrated on the first read and re-entrant when that read is cut short.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { setBoardDir, setBoardRoot } from '../src/lib/paths.ts'
import { addToInbox } from '../src/lib/signals/add.ts'
import { signalConfigGaps } from '../src/lib/signals/config.ts'
import { fetchSignals } from '../src/lib/signals/fetch.ts'
import { archiveInboxItem, dismissInboxItem, readAllDismissed } from '../src/lib/signals/inbox.ts'
import { checkSource } from '../src/lib/signals/check.ts'
import { migrateTriage } from '../src/lib/signals/migrate.ts'
import { matchSourceType } from '../src/lib/signals/sources.ts'
import { dismissSignal, readSignals } from '../src/lib/signals/index.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-signals-'))
const kanban = () => path.join(root, 'docs', 'kanban')
const triage = () => path.join(kanban(), 'triage')
const dismissed = () => path.join(triage(), 'dismissed')
const archived = () => path.join(triage(), 'archived')
const files = () => path.join(triage(), 'files')

/** Every item file waiting to be sorted — the folder holds subfolders too. */
const waiting = () => fs.readdirSync(triage()).filter((name) => name.endsWith('.md'))

/** A board stamp so many days back, for the 30-day window. */
const day = (back: number) => {
  const at = new Date(Date.now() - back * 24 * 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} 09:00`
}

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
    `# Configuration\n\n- **Project** — A board.\n${endpoint ? `- **Triage endpoint** — ${ENDPOINT}\n` : ''}`,
  )
  if (token) fs.writeFileSync(path.join(kanban(), '.env'), 'TRIAGE_ENDPOINT_TOKEN=a-secret\n')
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
    assert.equal(waiting().length, 2)

    const inboxNow = readSignals()
    assert.equal(inboxNow.relPath, 'docs/kanban/triage')
    assert.equal(inboxNow.signals.length, 2)
    const [first] = inboxNow.signals
    assert.equal(first!.title, 'Signal a1')
    assert.equal(first!.sourceType, 'reddit')
    assert.equal(first!.summary, 'What somebody said, in their own words.')
    assert.match(first!.collectedAt, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
    assert.equal(inboxNow.latestImport, first!.importedAt)
  })

  it('makes the folder on the first pull and not before', async () => {
    assert.equal(fs.existsSync(triage()), false)
    assert.deepEqual(readSignals().signals, [])
    answerWith({ signals: [wire('a1')] })
    await fetchSignals()
    assert.equal(fs.existsSync(triage()), true)
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
    assert.equal(only!.sourceType, '')
    assert.deepEqual(only!.meta, [])
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

  it('reads the link\'s domain against the source list when nothing else says a type', async () => {
    answerWith({
      signals: [
        { title: 'A post', summary: 'Words.', url: 'https://old.reddit.com/r/a/comments/b/' },
        { title: 'Elsewhere', summary: 'Words.', url: 'https://www.example.test/a/b' },
      ],
    })
    await fetchSignals()
    const by = new Map(readSignals().signals.map((s) => [s.title, s]))
    assert.equal(by.get('A post')!.sourceType, 'reddit')
    // A domain the list has not got names no source, and the board no longer stands one in.
    assert.equal(by.get('Elsewhere')!.sourceType, '')
    assert.deepEqual(by.get('Elsewhere')!.meta, [])
  })

  it('still reads `platform` from an endpoint written before the rename', async () => {
    answerWith({ signals: [{ title: 'A post', summary: 'Words.', platform: '知乎' }] })
    await fetchSignals()
    assert.equal(readSignals().signals[0]!.sourceType, 'zhihu')
  })

  it('keeps a `platform` the list has not got as a meta entry rather than losing it', async () => {
    answerWith({ signals: [{ title: 'A post', summary: 'Words.', platform: 'Hacker News' }] })
    await fetchSignals()
    const [only] = readSignals().signals
    assert.equal(only!.sourceType, '')
    assert.deepEqual(only!.meta, [{ key: 'source', value: 'Hacker News' }])
  })

  it('takes a `source_type` the list has not got exactly as it was sent', async () => {
    answerWith({ signals: [{ title: 'A post', summary: 'Words.', source_type: 'customer-forum' }] })
    await fetchSignals()
    assert.equal(readSignals().signals[0]!.sourceType, 'customer-forum')
  })

  it('takes any `meta` pairs in order, and leaves out what a line will not hold', async () => {
    answerWith({
      signals: [
        {
          title: 'A post',
          summary: 'Words.',
          source_type: 'Reddit',
          meta: {
            subreddit: 'r/productivity',
            author: 'u/mira',
            score: 312,
            comments: { count: 4 },
            tags: ['a', 'b'],
            note: 'two\nlines',
          },
        },
      ],
    })
    await fetchSignals()
    const [only] = readSignals().signals
    assert.equal(only!.sourceType, 'reddit')
    assert.deepEqual(only!.meta, [
      { key: 'subreddit', value: 'r/productivity' },
      { key: 'author', value: 'u/mira' },
      { key: 'score', value: '312' },
    ])
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
    assert.equal(report.failed[0]!.which, 'item 1')
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
    assert.equal(fs.existsSync(triage()), false)
  })

  it('writes nothing when the answer carries no signals list', async () => {
    answerWith({ items: [] })
    await assert.rejects(fetchSignals(), /`signals` list/)
    assert.equal(fs.existsSync(triage()), false)
  })

  it('names what is missing before it asks anything', async () => {
    configure({ endpoint: false, token: false })
    assert.deepEqual(
      signalConfigGaps().map((gap) => gap.what),
      ['endpoint', 'token'],
    )
    answerWith({ signals: [wire('a1')] })
    await assert.rejects(fetchSignals(), /not set up to pull triage items/)
    assert.equal(asked, null)
  })

  it('reads a placeholder endpoint as no endpoint at all', () => {
    fs.writeFileSync(path.join(kanban(), 'config.md'), '# Configuration\n\n- **Triage endpoint** — <url>\n')
    assert.deepEqual(
      signalConfigGaps().map((gap) => gap.what),
      ['endpoint'],
    )
  })
})

describe('ignoring a signal (#559)', () => {
  it('moves the file into dismissed/ rather than deleting it, and keeps it out of a pull', async () => {
    answerWith({ signals: [wire('a1'), wire('a2')] })
    await fetchSignals()

    assert.deepEqual(dismissSignal('a1'), { ok: true })
    assert.deepEqual(
      readSignals().signals.map((s) => s.sourceId),
      ['a2'],
    )
    const [kept] = readAllDismissed()
    assert.equal(kept!.sourceId, 'a1')
    assert.equal(kept!.title, 'Signal a1')
    assert.equal(kept!.dismissedBy, 'user')
    assert.equal(kept!.dismissedReason, '')
    assert.match(kept!.dismissedAt, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
    assert.equal(waiting().length, 1)

    answerWith({ signals: [wire('a1'), wire('a2')] })
    const again = await fetchSignals()
    assert.equal(again.added.length, 0)
    assert.equal(again.skipped, 2)
  })

  it('records the reason and the judge when an agent is the one ignoring it', async () => {
    answerWith({ signals: [wire('a1')] })
    await fetchSignals()
    const done = dismissInboxItem('a1', 'agent', '  already a card  ')
    assert.equal(done.ok, true)
    const [kept] = readAllDismissed()
    assert.equal(kept!.dismissedBy, 'agent')
    assert.equal(kept!.dismissedReason, 'already a card')
    assert.equal(kept!.contentKept, true)
  })

  it('keeps one record per source id, judged afresh, when the same thing is ignored twice', async () => {
    answerWith({ signals: [wire('a1')] })
    await fetchSignals()
    dismissInboxItem('a1', 'agent', 'the first call')
    // Pasted back in by hand — which a dismissal never blocks — then ignored again.
    assert.equal(addToInbox({ title: 'Signal a1', text: 'What somebody said, in their own words.' }).ok, true)
    const back = readSignals().signals[0]!.sourceId
    dismissInboxItem(back, 'user')
    const held = readAllDismissed()
    assert.equal(held.filter((s) => s.sourceId === back).length, 1)
    assert.equal(held.find((s) => s.sourceId === back)!.dismissedBy, 'user')
    assert.equal(held.find((s) => s.sourceId === back)!.dismissedReason, '')
  })

  it('leaves fields it does not know about exactly where they were', async () => {
    fs.mkdirSync(triage(), { recursive: true })
    fs.writeFileSync(
      path.join(triage(), 'odd.md'),
      `---\nsource_id: odd\ntitle: An odd one\ncollected_at: 2026-09-06 21:40\nimported_at: 2026-09-06 21:41\nfuture_field: kept\n---\n\nWords.\n`,
    )
    assert.equal(dismissInboxItem('odd', 'user').ok, true)
    const written = fs.readFileSync(path.join(dismissed(), 'odd.md'), 'utf8')
    assert.match(written, /future_field: kept/)
    assert.match(written, /dismissed_by: user/)
    assert.match(written, /\nWords\./)
  })

  it('refuses an id nothing is waiting under', () => {
    assert.equal(dismissSignal('nobody').ok, false)
    assert.equal(dismissSignal('').ok, false)
  })

  it('reads only the last 30 days back, and counts nothing older', async () => {
    fs.mkdirSync(dismissed(), { recursive: true })
    const write = (id: string, at: string) =>
      fs.writeFileSync(
        path.join(dismissed(), `${id}.md`),
        `---\nsource_id: ${id}\ntitle: Item ${id}\ncollected_at: ${day(40)}\nimported_at: ${day(40)}\ndismissed_at: ${at}\n---\n\nWords.\n`,
      )
    write('inside', day(29))
    write('edge', day(31))
    assert.deepEqual(
      readSignals().dismissed.map((s) => s.sourceId),
      ['inside'],
    )
    // Out of the window is not out of the record: the older one still holds a pull off.
    assert.equal(readAllDismissed().length, 2)
    answerWith({ signals: [{ source_id: 'edge', title: 'Edge', summary: 'Words.' }] })
    assert.equal((await fetchSignals()).skipped, 1)
  })
})

describe('the one duplicate rule (#559)', () => {
  it('answers unseen, pending, archived and dismissed, with the file that says so', async () => {
    assert.deepEqual(checkSource('a1'), { status: 'unseen', relPath: '' })

    answerWith({ signals: [wire('a1'), wire('a2'), wire('a3')] })
    await fetchSignals()
    const pending = checkSource('a1')
    assert.equal(pending.status, 'pending')
    assert.match(pending.relPath, /^docs\/kanban\/triage\/[^/]+\.md$/)

    assert.equal(dismissSignal('a2').ok, true)
    assert.equal(checkSource('a2').status, 'dismissed')
    assert.match(checkSource('a2').relPath, /^docs\/kanban\/triage\/dismissed\//)

    assert.equal(archiveInboxItem('a3', 91).ok, true)
    assert.equal(checkSource('a3').status, 'archived')
    assert.match(fs.readFileSync(path.join(archived(), fs.readdirSync(archived())[0]!), 'utf8'), /card_id: 91/)
  })

  it('reports the first of pending, archived, dismissed when a source id is in two places', async () => {
    answerWith({ signals: [wire('a1')] })
    await fetchSignals()
    dismissSignal('a1')
    // Pasted back in: the dismissed record stays, and the waiting copy is what is reported.
    fs.writeFileSync(
      path.join(triage(), 'again.md'),
      `---\nsource_id: a1\ntitle: Signal a1\ncollected_at: 2026-09-06 21:40\nimported_at: 2026-09-06 21:41\n---\n\nWords.\n`,
    )
    assert.equal(checkSource('a1').status, 'pending')
    assert.equal(checkSource('a1').relPath, 'docs/kanban/triage/again.md')
  })

  it('refuses a hand-written add that is already waiting or already a card, and says where', async () => {
    assert.equal(addToInbox({ text: 'https://example.test/a' }).ok, true)
    const already = addToInbox({ text: 'https://example.test/a' })
    assert.equal(already.ok, false)
    assert.match(already.ok ? '' : already.error, /already waiting in triage — docs\/kanban\/triage\//)

    const id = readSignals().signals[0]!.sourceId
    assert.equal(archiveInboxItem(id, 92).ok, true)
    const carded = addToInbox({ text: 'https://example.test/a' })
    assert.equal(carded.ok, false)
    assert.match(carded.ok ? '' : carded.error, /a card was already made of that — docs\/kanban\/triage\/archived\//)
  })

  it('takes a hand-written add of something only ignored, and leaves the record where it is', () => {
    assert.equal(addToInbox({ text: 'https://example.test/a' }).ok, true)
    const id = readSignals().signals[0]!.sourceId
    assert.equal(dismissSignal(id).ok, true)
    assert.equal(addToInbox({ text: 'https://example.test/a' }).ok, true)
    assert.deepEqual(
      readSignals().signals.map((s) => s.sourceId),
      [id],
    )
    assert.equal(readAllDismissed().filter((s) => s.sourceId === id).length, 1)
  })
})

describe('adding to the inbox by hand (#499)', () => {
  it('takes a pasted link, named by where it points', () => {
    const done = addToInbox({ text: '  https://www.example.test/blog/why-x  ' })
    assert.equal(done.ok, true)
    const [only] = readSignals().signals
    assert.equal(only!.title, 'example.test/blog/why-x')
    // A domain the source list has not got is a fact about the item, not a source (#560).
    assert.equal(only!.sourceType, '')
    assert.deepEqual(only!.meta, [{ key: 'domain', value: 'example.test' }])
    assert.equal(only!.url, 'https://www.example.test/blog/why-x')
  })

  it('reads a pasted link on a site the list knows as that source', () => {
    assert.equal(addToInbox({ text: 'https://www.xiaohongshu.com/explore/abc' }).ok, true)
    const [only] = readSignals().signals
    assert.equal(only!.sourceType, 'xiaohongshu')
    assert.deepEqual(only!.meta, [])
  })

  it('reads what `--source` says through the same rule', () => {
    assert.equal(addToInbox({ title: 'A post', text: 'Words.', source: '小红书' }).ok, true)
    assert.equal(readSignals().signals[0]!.sourceType, 'xiaohongshu')
  })

  it('takes pasted text, titled by its first line', () => {
    assert.equal(addToInbox({ text: 'Their pricing changed\n\nThe cheap tier is gone.' }).ok, true)
    const [only] = readSignals().signals
    assert.equal(only!.title, 'Their pricing changed')
    assert.match(only!.summary, /The cheap tier is gone\./)
    assert.equal(only!.url, '')
  })

  it('reads a dropped text file as the body, and keeps the file name as a meta entry', () => {
    assert.equal(addToInbox(dropped('issue-42.md', '# Newsletter 42\n\nWhat it said.')).ok, true)
    const [only] = readSignals().signals
    assert.equal(only!.title, 'Newsletter 42')
    assert.equal(only!.sourceType, '')
    assert.deepEqual(only!.meta, [{ key: 'filename', value: 'issue-42.md' }])
    assert.match(only!.summary, /What it said\./)
    assert.equal(fs.existsSync(files()), false)
  })

  it('copies a file it cannot read into the board, and the body says where', () => {
    const pdf = { file: { name: 'q3.pdf', type: 'application/pdf', data: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x00, 0xff]) } }
    assert.equal(addToInbox(pdf).ok, true)
    const [only] = readSignals().signals
    assert.equal(only!.title, 'q3')
    assert.deepEqual(only!.meta, [{ key: 'filename', value: 'q3.pdf' }])
    assert.match(only!.summary, /docs\/kanban\/triage\/files\/q3-[0-9a-f]{8}\.pdf/)
    assert.equal(fs.readdirSync(files()).length, 1)
    // The copy is in a folder of its own, not in the list: the list still holds one item.
    assert.equal(readSignals().signals.length, 1)
  })

  it('leaves no copy behind when it refuses a file the inbox already holds', () => {
    const pdf = () => ({ file: { name: 'q3.pdf', type: 'application/pdf', data: new Uint8Array([0x25, 0x50, 0x44, 0x46]) } })
    assert.equal(addToInbox(pdf()).ok, true)
    const kept = fs.readdirSync(files())
    assert.equal(addToInbox(pdf()).ok, false)
    assert.deepEqual(fs.readdirSync(files()), kept)
    assert.equal(readSignals().signals.length, 1)
  })

  it('refuses the same thing twice, and refuses an empty add', () => {
    assert.equal(addToInbox({ text: 'https://example.test/a' }).ok, true)
    const again = addToInbox({ text: 'https://example.test/a' })
    assert.equal(again.ok, false)
    assert.match(again.ok ? '' : again.error, /already waiting in triage/)
    assert.equal(addToInbox({ text: '   ' }).ok, false)
    assert.equal(addToInbox({}).ok, false)
  })

  it('writes the same kind of file the pull writes, so it dismisses the same way', () => {
    const done = addToInbox({ text: 'A thing worth doing\n\nBecause of this.' })
    assert.equal(done.ok, true)
    const id = readSignals().signals[0]!.sourceId
    assert.deepEqual(dismissSignal(id), { ok: true })
    assert.deepEqual(readSignals().signals, [])
    assert.equal(readAllDismissed()[0]!.sourceId, id)
  })
})

describe('the one source rule (#560)', () => {
  it('matches a key, an alias in any language, and a domain — and nothing else', () => {
    assert.equal(matchSourceType('reddit'), 'reddit')
    assert.equal(matchSourceType('  Reddit '), 'reddit')
    assert.equal(matchSourceType('小红书'), 'xiaohongshu')
    assert.equal(matchSourceType('推特'), 'x')
    assert.equal(matchSourceType('youtu.be'), 'youtube')
    assert.equal(matchSourceType('www.zhihu.com'), 'zhihu')
    assert.equal(matchSourceType('zhuanlan.zhihu.com'), 'zhihu')
    assert.equal(matchSourceType('notzhihu.com'), '')
    assert.equal(matchSourceType('a post on reddit'), '')
    assert.equal(matchSourceType(''), '')
  })
})

describe('a file written before the source list (#560)', () => {
  const write = (name: string, front: string) =>
    fs.writeFileSync(path.join(triage(), name), `---\n${front}\n---\n\nWhat it said.\n`)

  beforeEach(() => fs.mkdirSync(triage(), { recursive: true }))

  const stamps = 'collected_at: 2026-09-06 21:40\nimported_at: 2026-09-06 21:41'

  it('reads a free-text source the list knows as that type', () => {
    write('old.md', `source_id: old\ntitle: An old one\nsource: 知乎\n${stamps}`)
    const [only] = readSignals().signals
    assert.equal(only!.sourceType, 'zhihu')
    assert.deepEqual(only!.meta, [])
  })

  it('reads one the list has not got as a source meta entry, and leaves the file alone', () => {
    write('old.md', `source_id: old\ntitle: An old one\nplatform: A newsletter\n${stamps}`)
    const [only] = readSignals().signals
    assert.equal(only!.sourceType, '')
    assert.deepEqual(only!.meta, [{ key: 'source', value: 'A newsletter' }])
    assert.match(fs.readFileSync(path.join(triage(), 'old.md'), 'utf8'), /platform: A newsletter/)
  })

  it('reads a meta block in the order it was written, and skips a key with no value', () => {
    write(
      'new.md',
      `source_id: new\ntitle: A new one\nsource_type: reddit\n${stamps}\nmeta:\n  subreddit: r/productivity\n  author: u/mira\n  empty: ""`,
    )
    const [only] = readSignals().signals
    assert.deepEqual(only!.meta, [
      { key: 'subreddit', value: 'r/productivity' },
      { key: 'author', value: 'u/mira' },
    ])
  })

  it('writes a meta block a second read gives back unchanged', () => {
    assert.equal(addToInbox({ text: 'https://www.example.test/a' }).ok, true)
    const written = readSignals().signals[0]!
    assert.deepEqual(written.meta, [{ key: 'domain', value: 'example.test' }])
    assert.deepEqual(readSignals().signals[0]!.meta, written.meta)
  })
})

describe('what has been ignored (#559 writes it, #560 draws it)', () => {
  it('is empty on a board with no dismissed folder', () => {
    const inboxNow = readSignals()
    assert.deepEqual(inboxNow.dismissed, [])
    assert.equal(inboxNow.dismissedDays, 30)
    assert.deepEqual(inboxNow.sourceTypes, ['reddit', 'x', 'xiaohongshu', 'weibo', 'zhihu', 'youtube'])
  })

  it('reads the window newest first, and leaves out what fell out of it', () => {
    fs.mkdirSync(dismissed(), { recursive: true })
    const write = (id: string, at: string, why: string) =>
      fs.writeFileSync(
        path.join(dismissed(), `${id}.md`),
        `---\nsource_id: ${id}\ntitle: Item ${id}\nsource_type: reddit\ncollected_at: ${day(40)}\nimported_at: ${day(40)}\ndismissed_at: ${at}\ndismissed_by: agent\ndismissed_reason: ${why}\n---\n\nWords.\n`,
      )
    write('recent', day(2), 'not work')
    write('older', day(20), 'a duplicate')
    write('gone', day(45), 'long ago')

    const held = readSignals().dismissed
    assert.deepEqual(
      held.map((s) => s.sourceId),
      ['recent', 'older'],
    )
    assert.equal(held[0]!.dismissedReason, 'not work')
    assert.equal(held[0]!.dismissedBy, 'agent')
  })

  it('reads a record with a source id and a judged time and nothing else', () => {
    fs.mkdirSync(dismissed(), { recursive: true })
    fs.writeFileSync(
      path.join(dismissed(), 'stub.md'),
      `---\nsource_id: t3_gone\ndismissed_at: ${day(3)}\ncontent_kept: false\n---\n`,
    )
    const [only] = readSignals().dismissed
    assert.equal(only!.sourceId, 't3_gone')
    assert.equal(only!.title, '')
    assert.equal(only!.contentKept, false)
    assert.equal(only!.sourceType, '')
  })

  it('sorts one with no judged time to the end rather than dropping it', () => {
    fs.mkdirSync(dismissed(), { recursive: true })
    const write = (id: string, at: string) =>
      fs.writeFileSync(path.join(dismissed(), `${id}.md`), `---\nsource_id: ${id}\ndismissed_at: ${at}\n---\n`)
    write('dated', day(5))
    fs.writeFileSync(path.join(dismissed(), 'undated.md'), '---\nsource_id: undated\n---\n')
    assert.deepEqual(
      readSignals().dismissed.map((s) => s.sourceId),
      ['dated', 'undated'],
    )
  })
})

describe('a board written before #559', () => {
  const oldInbox = () => path.join(triage(), 'inbox')
  const handled = () => path.join(triage(), 'handled.md')

  const item = (id: string, body = 'Words.') =>
    `---\nsource_id: ${id}\ntitle: Item ${id}\ncollected_at: 2026-09-06 21:40\nimported_at: 2026-09-06 21:41\n---\n\n${body}\n`

  const seed = (ids: string[]) => {
    fs.mkdirSync(oldInbox(), { recursive: true })
    for (const id of ids) fs.writeFileSync(path.join(oldInbox(), `${id}.md`), item(id))
  }

  it('lifts the items up, moves the dropped files beside them, and takes the old folder away', () => {
    seed(['a1', 'a2'])
    fs.mkdirSync(path.join(oldInbox(), 'files'), { recursive: true })
    fs.writeFileSync(path.join(oldInbox(), 'files', 'q3-deadbeef.pdf'), 'bytes')
    fs.writeFileSync(
      path.join(oldInbox(), 'a3.md'),
      item('a3', 'q3.pdf — docs/kanban/triage/inbox/files/q3-deadbeef.pdf'),
    )

    assert.deepEqual(
      readSignals().signals.map((s) => s.sourceId).sort(),
      ['a1', 'a2', 'a3'],
    )
    assert.equal(fs.existsSync(oldInbox()), false)
    assert.deepEqual(fs.readdirSync(files()), ['q3-deadbeef.pdf'])
    // The path written into the body is rewritten once, and is good from then on.
    assert.match(
      readSignals().signals.find((s) => s.sourceId === 'a3')!.summary,
      /docs\/kanban\/triage\/files\/q3-deadbeef\.pdf/,
    )
  })

  it('turns every handled id with no file into a record that says its words were not kept', () => {
    seed(['a1'])
    fs.writeFileSync(handled(), `# Handled\n\n- a1 — 2026-09-01 08:00\n- t3_gone — 2026-09-02 09:30\n`)

    const held = readSignals()
    // `a1` still has a file, so the list said nothing the file does not already say.
    assert.deepEqual(
      held.signals.map((s) => s.sourceId),
      ['a1'],
    )
    const [only] = readAllDismissed()
    assert.equal(only!.sourceId, 't3_gone')
    assert.equal(only!.dismissedAt, '2026-09-02 09:30')
    assert.equal(only!.title, '')
    assert.equal(only!.summary, '')
    assert.equal(only!.dismissedBy, '')
    assert.equal(only!.dismissedReason, '')
    assert.equal(only!.contentKept, false)
    assert.equal(fs.existsSync(handled()), false)
  })

  it('still keeps a migrated id out of a later pull', async () => {
    fs.mkdirSync(triage(), { recursive: true })
    fs.writeFileSync(handled(), `# Handled\n\n- t3_gone — 2026-09-02 09:30\n`)
    migrateTriage()
    answerWith({ signals: [{ source_id: 't3_gone', title: 'Back again', summary: 'Words.' }] })
    const report = await fetchSignals()
    assert.equal(report.added.length, 0)
    assert.equal(report.skipped, 1)
  })

  it('runs again over a board it half-migrated without doubling anything', () => {
    seed(['a1', 'a2'])
    fs.writeFileSync(handled(), `# Handled\n\n- t3_gone — 2026-09-02 09:30\n`)
    // The state an interrupted run leaves: one item already lifted, the rest still below.
    fs.writeFileSync(path.join(triage(), 'a1.md'), item('a1'))

    migrateTriage()
    migrateTriage()
    assert.deepEqual(
      readSignals().signals.map((s) => s.sourceId).sort(),
      ['a1', 'a2'],
    )
    assert.equal(waiting().length, 2)
    assert.equal(readAllDismissed().length, 1)
  })

  it('never writes over a file name that is taken', () => {
    seed(['a1'])
    // A different item under the same name, already lifted.
    fs.writeFileSync(path.join(triage(), 'a1.md'), item('other'))
    migrateTriage()
    assert.deepEqual(
      readSignals().signals.map((s) => s.sourceId).sort(),
      ['a1', 'other'],
    )
    assert.equal(fs.readFileSync(path.join(triage(), 'a1.md'), 'utf8'), item('other'))
  })

  it('repoints a board that is not at docs/kanban at its own new files folder', () => {
    // A board named outright by `--board` (#407): the path an item body carries is that
    // board's, so what the migration looks for has to be too.
    const board = path.join(root, 'product', 'kanban')
    fs.mkdirSync(path.join(board, 'triage', 'inbox', 'files'), { recursive: true })
    setBoardDir(board, root)
    fs.writeFileSync(path.join(board, 'triage', 'inbox', 'files', 'q3-deadbeef.pdf'), 'bytes')
    fs.writeFileSync(
      path.join(board, 'triage', 'inbox', 'a3.md'),
      item('a3', 'q3.pdf — product/kanban/triage/inbox/files/q3-deadbeef.pdf'),
    )

    migrateTriage()
    assert.equal(
      readSignals().signals.find((s) => s.sourceId === 'a3')!.summary,
      'q3.pdf — product/kanban/triage/files/q3-deadbeef.pdf',
    )
    fs.rmSync(path.join(root, 'product'), { recursive: true, force: true })
  })

  it('does nothing at all to a board that is already there', () => {
    fs.mkdirSync(triage(), { recursive: true })
    fs.writeFileSync(path.join(triage(), 'a1.md'), item('a1'))
    migrateTriage()
    assert.equal(waiting().length, 1)
    assert.equal(fs.existsSync(dismissed()), false)
  })
})
