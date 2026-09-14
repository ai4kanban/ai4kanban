// node --test scripts/newsletter/newsletter.test.mjs
//
// The rules that decide who gets mailed, and the ones that decide who never does again.

import test from 'node:test'
import assert from 'node:assert/strict'
import { applyUnsubscribes, unsubscribeToken } from './list.mjs'
import { renderIssue, validateIssue, withoutImages } from './template.mjs'
import { classify, issueImages, pending, stopDelivering } from '../newsletter-send.mjs'

const subscriber = (over) => ({
  login: 'alice',
  email: 'alice@example.org',
  deliverable: true,
  unsubscribed: false,
  sends: [],
  ...over,
})

test('a token is stable for an address and tells two apart', () => {
  assert.equal(unsubscribeToken('a@b.co', 'k'), unsubscribeToken('A@B.CO ', 'k'))
  assert.notEqual(unsubscribeToken('a@b.co', 'k'), unsubscribeToken('c@d.co', 'k'))
  assert.match(unsubscribeToken('a@b.co', 'k'), /^[0-9a-f]{24}$/)
})

test('an unsubscribe survives the person changing address', () => {
  const list = { unsubscribed_emails: ['alice@example.org'], unsubscribed_logins: [], subscribers: [subscriber()] }
  applyUnsubscribes(list)
  assert.deepEqual(list.unsubscribed_logins, ['alice'])

  // The next collection run finds her under a new address.
  list.subscribers = [subscriber({ email: 'alice@new.org', unsubscribed: false, deliverable: true })]
  applyUnsubscribes(list)
  assert.equal(list.subscribers[0].unsubscribed, true)
  assert.equal(list.subscribers[0].deliverable, false)
  assert.ok(list.unsubscribed_emails.includes('alice@new.org'))
})

test('a freshly collected record is blocked by its login before anyone looks its address up', () => {
  // What the collector's lookup queue filters on: it skips `unsubscribed` records, so the
  // person who left has to be flagged while their `email` is still null.
  const list = {
    unsubscribed_emails: [],
    unsubscribed_logins: ['bob'],
    subscribers: [subscriber({ login: 'bob', email: null, deliverable: false })],
  }
  applyUnsubscribes(list)
  assert.equal(list.subscribers[0].unsubscribed, true)
})

test('a resend event decides whether the address is worth another attempt', () => {
  assert.equal(classify('delivered'), 'done')
  assert.equal(classify('sent'), 'pending')
  assert.equal(classify('delivery_delayed'), 'retry')
  assert.equal(classify('bounced', 'Transient'), 'retry')
  assert.equal(classify('bounced', 'Permanent'), 'stop')
  assert.equal(classify('bounced'), 'stop')
  assert.equal(classify('complained'), 'stop')
})

test('a hard bounce or a complaint takes the address off every issue after it', () => {
  for (const [event, reason] of [
    ['bounced', 'hard_bounce'],
    ['complained', 'complaint'],
  ]) {
    const record = subscriber({ sends: [{ issue: '1', state: 'sent', last_event: event }] })
    stopDelivering(record, record.sends[0])
    assert.equal(record.deliverable, false)
    assert.equal(record.undeliverable_reason, reason)
    assert.equal(record.sends[0].state, event)
    assert.deepEqual(pending({ subscribers: [record] }, '2'), [])
  }
})

test('an issue is owed to everyone deliverable who has not had it', () => {
  const list = {
    subscribers: [
      subscriber({ login: 'a', email: 'a@x.org' }),
      subscriber({ login: 'b', email: 'b@x.org', unsubscribed: true }),
      subscriber({ login: 'c', email: 'c@x.org', sends: [{ issue: '1', state: 'sent' }] }),
      subscriber({ login: 'd', email: 'd@x.org', sends: [{ issue: '1', state: 'retry' }] }),
      subscriber({ login: 'e', email: 'a@x.org' }),
      subscriber({ login: 'f', email: 'f@x.org', deliverable: false }),
    ],
  }
  assert.deepEqual(
    pending(list, '1').map((r) => r.login),
    ['a', 'd'],
  )
})

test('an address already sent this issue is not owed a second copy under another record', () => {
  // A resumed run: the first record has its copy, the duplicate has no send of its own.
  const list = {
    subscribers: [
      subscriber({ login: 'c', email: 'dup@x.org', sends: [{ issue: '1', state: 'sent' }] }),
      subscriber({ login: 'e', email: 'dup@x.org' }),
    ],
  }
  assert.deepEqual(pending(list, '1'), [])
})

const issue = {
  subject: 'This week',
  preheader: 'What changed',
  eyebrow: 'THIS WEEK',
  headline: 'A little more room',
  intro: 'Three things landed.',
  hero: { src: '/newsletter/example/hero.jpg', alt: 'The Runs office' },
  highlights: [{ label: 'RUNS', title: 'One room', body: 'Eight desks.' }],
  cta: { label: 'Get it', href: 'https://ai4kanban.dev/download' },
}

test('an issue is refused when a field is missing or is not English', () => {
  assert.deepEqual(validateIssue(issue), [])
  assert.deepEqual(validateIssue({ ...issue, headline: '' }), ['headline is missing'])
  assert.deepEqual(validateIssue({ ...issue, intro: '本周更新' }), ['intro is not English'])
})

test('the issue carries its own unsubscribe link and stays readable without images', () => {
  const url = 'https://ai4kanban.dev/unsubscribe?t=0123456789abcdef01234567'
  const mail = renderIssue(issue, { unsubscribeUrl: url })
  assert.ok(mail.html.includes(url))
  assert.ok(mail.html.includes('https://ai4kanban.dev/newsletter/example/hero.jpg'))
  assert.ok(!mail.html.includes('<style'))
  assert.ok(mail.text.includes(url))

  const off = withoutImages(mail.html)
  assert.ok(!off.includes('<img'))
  assert.ok(off.includes('One room'))
  assert.ok(off.includes(url))
})

// ---------------------------------------------------------------- a picture per highlight

const url = 'https://ai4kanban.dev/unsubscribe?t=0123456789abcdef01234567'
const shot = { src: 'https://cdn.ai4kanban.dev/newsletter/x/runs-v1.png', alt: 'Six agents at desks' }
const illustrated = {
  ...issue,
  hero: undefined,
  highlights: [
    { label: 'RUNS', title: 'One room', body: 'Eight desks.', image: shot },
    { label: 'DELIVERY', title: 'No chasing', body: 'It starts over by itself.' },
  ],
}

test('a highlight with a picture shows it in HTML, describes it in plain text, and drops it with images off', () => {
  const mail = renderIssue(illustrated, { unsubscribeUrl: url })
  assert.ok(mail.html.includes(`<img src="${shot.src}"`))
  assert.ok(mail.html.includes(`alt="${shot.alt}"`))
  assert.ok(mail.text.includes(`[${shot.alt}]`))

  const off = withoutImages(mail.html)
  assert.ok(!off.includes('<img'))
  assert.ok(!off.includes(shot.alt))

  // The words stand in all three, picture or no picture.
  for (const out of [mail.html, mail.text, off]) {
    assert.ok(out.includes('Eight desks.'))
    assert.ok(out.includes('It starts over by itself.'))
  }
})

test('a highlight with no picture of its own stays plain text', () => {
  const mail = renderIssue(illustrated, { unsubscribeUrl: url })
  assert.equal(mail.html.match(/<img\b/g).length, 3) // two logos and the one picture
  assert.ok(!mail.text.includes('[It starts over'))
})

test('a picture is refused when it is missing its address or its description', () => {
  const broken = (image) => ({ ...illustrated, highlights: [{ ...illustrated.highlights[0], image }] })
  assert.deepEqual(validateIssue(broken({ alt: 'Six agents' })), ['highlights[0].image.src is missing'])
  assert.deepEqual(validateIssue(broken({ src: shot.src })), ['highlights[0].image.alt is missing'])
  assert.deepEqual(validateIssue(broken({ src: shot.src, alt: '六个 agent' })), ['highlights[0].image.alt is not English'])
})

test('a picture already hosted elsewhere is not hung off the site root', () => {
  const mail = renderIssue(illustrated, { unsubscribeUrl: url })
  assert.ok(!mail.html.includes(`https://ai4kanban.dev${shot.src}`))
  assert.ok(mail.html.includes('https://ai4kanban.dev/newsletter/logo.png'))
})

test('an issue with no hero renders, and the send still checks every picture in it', () => {
  const mail = renderIssue(illustrated, { unsubscribeUrl: url })
  const off = withoutImages(mail.html)
  for (const out of [mail.html, mail.text, off]) assert.ok(out.includes('One room'))
  assert.ok(!mail.text.includes('undefined'))

  assert.deepEqual(issueImages(illustrated), ['/newsletter/logo.png', shot.src])
  assert.deepEqual(issueImages(issue), ['/newsletter/logo.png', issue.hero.src])
})

test('an issue cannot smuggle markup into the email', () => {
  const mail = renderIssue({ ...issue, headline: '<script>x</script>' }, { unsubscribeUrl: 'https://x.dev/u' })
  assert.ok(!mail.html.includes('<script>'))
  assert.ok(mail.html.includes('&lt;script&gt;'))
})
