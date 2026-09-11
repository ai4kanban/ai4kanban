// The pictures pasted into a conversation (#441).
//
// The promise is three things. A picture is a file beside the transcript, named by the board
// and reachable only by that name — nothing a browser says can reach a path. It goes to the
// agent the way that connector takes one, and to no connector that takes none. And it lives
// as long as the conversation does, so clearing takes it and a resend re-sends it rather
// than saving it twice.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import {
  addChatImage,
  adoptChatPictures,
  chatImageFile,
  chatPrompt,
  clearChat,
  dropChatImage,
  readChat,
  readChatView,
  sendChatMessage,
} from '../src/lib/agent/chat.ts'
import { addRunPicture, pictureBox, runPictureFile } from '../src/lib/agent/pictures.ts'
import { CHATS_DIR, setBoardRoot, SESSIONS_DIR } from '../src/lib/paths.ts'
import { restoreMachineHome } from './helpers/board.ts'

let root = ''
let home = ''

// One real PNG, one pixel of it — enough that what is written back is what went in.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

// The board on one agent, with a command that answers instantly — what is asserted is the
// argv it was spawned with, not what an agent made of it.
const config = (harness: string, settings: Record<string, unknown> = {}): void => {
  const kanban = path.join(root, 'docs', 'kanban')
  fs.mkdirSync(kanban, { recursive: true })
  fs.writeFileSync(
    path.join(kanban, 'ui.config.json'),
    JSON.stringify({ harness, harnessSettings: { [harness]: settings } }, null, 2),
  )
  setBoardRoot(root)
}

// A stand-in agent that writes its own argv where the test can read it, so what reached the
// command line is the assertion rather than a reading of the code that built it.
function spy(harness: string): string {
  const agent = path.join(root, 'agent.mjs')
  const seen = path.join(root, 'argv.json')
  fs.writeFileSync(
    agent,
    `import fs from 'node:fs'\n` +
      `fs.writeFileSync(${JSON.stringify(seen)}, JSON.stringify(process.argv.slice(2)))\n`,
  )
  config(harness, { command: `node ${agent}` })
  return seen
}

const paste = (): string => {
  const saved = addChatImage(null, new Uint8Array(PNG), 'image/png')
  assert.ok('name' in saved)
  return saved.name
}

// The create sheet's own box (#517), which a Discuss send moves into the conversation.
const BOX = '11111111-1111-4111-8111-111111111111'
const RUN = '22222222-2222-4222-8222-222222222222'

const intoBox = (box = BOX): string => {
  const saved = addRunPicture(box, new Uint8Array(PNG), 'image/png')
  assert.ok('name' in saved, 'error' in saved ? saved.error : '')
  return saved.name
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-chat-images-'))
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-chat-images-home-'))
  process.env.AI4KANBAN_HOME = home
  config('claude-code')
})

afterEach(() => {
  restoreMachineHome()
  fs.rmSync(root, { recursive: true, force: true })
  fs.rmSync(home, { recursive: true, force: true })
})

describe('a picture saved beside a conversation', () => {
  it('is filed under a name of the board’s own, holding the bytes that came in', () => {
    const name = paste()
    const file = chatImageFile(null, name)!
    assert.ok(file.startsWith(path.join(CHATS_DIR, 'board.images') + path.sep))
    assert.deepEqual(fs.readFileSync(file), PNG)
  })

  it('is another conversation’s business alone', () => {
    const name = paste()
    assert.equal(chatImageFile(12, name), null)
  })

  it('reaches nothing outside its own folder, whatever the name says', () => {
    assert.equal(chatImageFile(null, '../../../etc/passwd'), null)
    assert.equal(chatImageFile(null, 'board.json'), null)
  })

  it('refuses what is not a picture rather than filing it under a made-up name', () => {
    const saved = addChatImage(null, new Uint8Array(PNG), 'text/plain')
    assert.ok('error' in saved && /not a picture/.test(saved.error))
  })

  it('goes when it is taken back out of the box, and when the conversation is cleared', () => {
    const dropped = paste()
    const kept = paste()
    dropChatImage(null, dropped)
    assert.equal(chatImageFile(null, dropped), null)
    assert.ok(chatImageFile(null, kept))
    clearChat(null)
    assert.equal(chatImageFile(null, kept), null)
  })
})

describe('the create sheet’s box a Discuss send takes over (#530)', () => {
  it('moves its pictures beside the conversation under the same names, and the box goes', () => {
    const one = intoBox()
    const two = intoBox()
    assert.deepEqual(adoptChatPictures(null, BOX, [one, two]), [one, two])
    assert.deepEqual(fs.readFileSync(chatImageFile(null, one)!), PNG)
    assert.ok(chatImageFile(null, two))
    assert.ok(!fs.existsSync(pictureBox(BOX)))
  })

  it('is another conversation’s business alone', () => {
    const name = intoBox()
    adoptChatPictures(null, BOX, [name])
    assert.equal(chatImageFile(12, name), null)
  })

  it('answers with the names that landed — one gone or never ours is not one of them', () => {
    const name = intoBox()
    const gone = '33333333-3333-4333-8333-333333333333.png'
    assert.deepEqual(adoptChatPictures(null, BOX, ['../../../etc/passwd', name, gone]), [name])
  })

  it('takes nothing out of a folder a run already owns', () => {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true })
    const name = intoBox(RUN)
    fs.writeFileSync(path.join(SESSIONS_DIR, `${RUN}.log`), 'working')
    assert.deepEqual(adoptChatPictures(null, RUN, [name]), [])
    assert.ok(runPictureFile(RUN, name))
  })

  it('leaves the message that follows carrying them', async () => {
    const seen = spy('claude-code')
    const name = intoBox()
    const landed = adoptChatPictures(null, BOX, [name])
    await sendChatMessage(null, 'what is this?', { images: landed })
    const argv = JSON.parse(fs.readFileSync(seen, 'utf8')) as string[]
    assert.ok(argv[argv.length - 1]!.includes(chatImageFile(null, name)!))
    assert.deepEqual(readChat(null)!.messages[0]!.images, [name])
  })
})

describe('a message that carries pictures', () => {
  it('records them on the message, and reads them back off the transcript', async () => {
    const seen = spy('claude-code')
    const name = paste()
    await sendChatMessage(null, 'what is this?', { images: [name] })
    assert.ok(fs.existsSync(seen))
    const said = readChat(null)!.messages[0]!
    assert.deepEqual(said.images, [name])
  })

  it('is a message with no words at all', async () => {
    spy('claude-code')
    const name = paste()
    const sent = await sendChatMessage(null, '', { images: [name] })
    assert.ok(!('error' in sent))
    assert.equal(readChat(null)!.messages[0]!.text, '')
  })

  it('drops one whose file has gone, and fails when that leaves nothing', async () => {
    spy('claude-code')
    const gone = paste()
    dropChatImage(null, gone)
    const sent = await sendChatMessage(null, '', { images: [gone] })
    assert.ok('error' in sent && /no longer on this machine/.test(sent.error))
  })

  it('is turned away whole by an agent that cannot see one', async () => {
    config('grok')
    const name = paste()
    const sent = await sendChatMessage(null, 'what is this?', { images: [name] })
    assert.ok('error' in sent && /can't see images/.test(sent.error))
    // And it names where to go, the way every other refusal does.
    assert.ok('error' in sent && /Claude Code/.test(sent.error))
    assert.equal(readChat(null), null)
  })
})

describe('how one reaches the agent', () => {
  it('is written into the words for a connector that reads a path', async () => {
    const seen = spy('claude-code')
    const name = paste()
    await sendChatMessage(null, 'what is this?', { images: [name] })
    const argv = JSON.parse(fs.readFileSync(seen, 'utf8')) as string[]
    assert.ok(!argv.includes('--image'))
    assert.ok(argv[argv.length - 1]!.includes(chatImageFile(null, name)!))
  })

  it('is a flag per file for a connector whose CLI takes one', async () => {
    const seen = spy('codex')
    const one = paste()
    const two = paste()
    await sendChatMessage(null, 'which is which?', { images: [one, two] })
    const argv = JSON.parse(fs.readFileSync(seen, 'utf8')) as string[]
    // One token per file, `--image=<FILE>`: Codex's own flag takes a LIST, and spelt as two
    // tokens the last one would swallow the prompt that follows it.
    assert.deepEqual(
      argv.filter((tok) => tok.startsWith('--image')),
      [`--image=${chatImageFile(null, one)}`, `--image=${chatImageFile(null, two)}`],
    )
    // And the words say nothing about them — the flag is where they went.
    assert.ok(!argv[argv.length - 1]!.includes('.png'))
  })

  it('reaches OpenCode as one token, so its array flag cannot swallow the prompt', async () => {
    const seen = spy('opencode')
    const name = paste()
    await sendChatMessage(null, 'what is this?', { images: [name] })
    const argv = JSON.parse(fs.readFileSync(seen, 'utf8')) as string[]
    assert.ok(argv.includes(`--file=${chatImageFile(null, name)}`))
  })

  it('follows the connector the chat actually spawns, not the board’s default', async () => {
    // A chat runs the discussion helper's connector (#443, #502). Here that is Claude Code,
    // which reads a path out of the words, while the board's default is Codex, which takes a
    // flag — reading the default instead sends the message with the pictures named nowhere.
    const agent = path.join(root, 'agent.mjs')
    const seen = path.join(root, 'argv.json')
    fs.writeFileSync(
      agent,
      `import fs from 'node:fs'\n` +
        `fs.writeFileSync(${JSON.stringify(seen)}, JSON.stringify(process.argv.slice(2)))\n`,
    )
    fs.writeFileSync(
      path.join(root, 'docs', 'kanban', 'ui.config.json'),
      JSON.stringify({
        harness: 'codex',
        agentHarness: { 'discussion-helper': 'claude-code' },
        harnessSettings: { 'claude-code': { command: `node ${agent}` } },
      }),
    )
    setBoardRoot(root)
    const name = paste()
    await sendChatMessage(null, 'what is this?', { images: [name] })
    const argv = JSON.parse(fs.readFileSync(seen, 'utf8')) as string[]
    assert.ok(!argv.some((tok) => tok.startsWith('--image')))
    assert.ok(argv[argv.length - 1]!.includes(chatImageFile(null, name)!))
  })
})

describe('what the words say about them', () => {
  it('names each file, above the message, for a connector that reads paths', () => {
    const prompt = chatPrompt(null, 'what is this?', { resuming: true, pictures: ['/a.png', '/b.png'] })
    assert.match(prompt, /2 pictures came with this message/)
    assert.ok(prompt.indexOf('/a.png') < prompt.indexOf('what is this?'))
  })

  it('says nothing at all when the message carried none', () => {
    assert.doesNotMatch(chatPrompt(null, 'hello', { resuming: true, pictures: [] }), /picture came|pictures came/)
  })
})

describe('what a conversation says it can take', () => {
  it('answers for the agent it actually runs, and names the ones that can', () => {
    config('claude-code')
    assert.equal(readChatView(null).seesImages, true)
    config('grok')
    const view = readChatView(null)
    assert.equal(view.seesImages, false)
    assert.deepEqual(view.imagesAble, ['Claude Code', 'Codex', 'Cursor', 'OpenCode'])
  })
})
