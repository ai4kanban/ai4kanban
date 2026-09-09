// Finding the Codex CLI a desktop app brought with it (#550).
//
// On Windows nothing puts `codex` on the PATH, and the CLI Desktop uses sits under a folder
// named after a build hash, inside a root with a space in its name. So three things are held
// here: which files a scan offers and in what order, that the resolved path survives every
// re-split of the command string on its way to a run, and that an executable which is on the
// machine and still won't start is told apart from one that isn't there.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, afterEach, beforeEach, describe, it } from 'node:test'

import { codexOnWindows } from '../src/lib/agent/harnesses/codex.ts'
import { harnessByName } from '../src/lib/agent/harnesses/index.ts'
import { ask, readLogin, type Ask } from '../src/lib/agent/login.ts'
import { commandOf, planRun } from '../src/lib/agent/resolve.ts'
import { setBoardRoot } from '../src/lib/paths.ts'

const CODEX = harnessByName('codex')!

/** How this machine's architecture is spelt in the folder names each layout uses — Windows'
 *  own package word, and the Rust target the standalone release is built for. The fixtures
 *  are written with it so they are ones this machine would actually keep. */
const ARCH =
  process.arch === 'arm64'
    ? { pkg: 'arm64', target: 'aarch64' }
    : process.arch === 'ia32'
      ? { pkg: 'x86', target: 'i686' }
      : { pkg: 'x64', target: 'x86_64' }

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-discovery-'))
const held = {
  PATH: process.env.PATH,
  LOCALAPPDATA: process.env.LOCALAPPDATA,
  USERPROFILE: process.env.USERPROFILE,
  ProgramFiles: process.env.ProgramFiles,
  CODEX_CLI_PATH: process.env.CODEX_CLI_PATH,
}

/** A file, with every folder above it. `at` sets its modification time, so the cache's own
 *  ordering can be asked for on purpose rather than raced for. */
function file(target: string, at?: number): string {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, '', { mode: 0o755 })
  if (at !== undefined) fs.utimesSync(target, at / 1000, at / 1000)
  return target
}

/** A PATH holding exactly these commands, so what the machine running the tests has
 *  installed changes nothing. */
function onPath(...binaries: string[]): void {
  const bin = path.join(root, 'bin')
  fs.rmSync(bin, { recursive: true, force: true })
  fs.mkdirSync(bin, { recursive: true })
  for (const name of binaries) fs.writeFileSync(path.join(bin, name), '', { mode: 0o755 })
  process.env.PATH = bin
}

/** What a lookup would actually offer: the scan's candidates, minus the ones that aren't
 *  there. The scan names every layout whether or not this machine has it, and the existence
 *  check is `bundledBinary`'s — the same read a lookup makes, taken fresh every time. */
function discovered(): string[] {
  return codexOnWindows().filter((one) => fs.existsSync(one))
}

/** The Windows roots pointed at a fresh scratch folder, the way a scan reads them. */
function windowsRoots(): { local: string; profile: string; programs: string } {
  const local = path.join(root, 'win', 'Local App Data')
  const profile = path.join(root, 'win', 'Users', 'a b')
  const programs = path.join(root, 'win', 'Program Files')
  process.env.LOCALAPPDATA = local
  process.env.USERPROFILE = profile
  process.env.ProgramFiles = programs
  return { local, profile, programs }
}

beforeEach(() => {
  fs.rmSync(path.join(root, 'win'), { recursive: true, force: true })
  delete process.env.CODEX_CLI_PATH
  onPath()
})

afterEach(() => {
  for (const [key, value] of Object.entries(held)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

after(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('the Windows scan', () => {
  it('offers the Desktop cache newest first, whatever the hashes are called', () => {
    const { local } = windowsRoots()
    const bin = path.join(local, 'OpenAI', 'Codex', 'bin')
    const old = file(path.join(bin, 'ffffffffffffffff', 'codex.exe'), 1_000_000)
    const fresh = file(path.join(bin, '0000000000000000', 'codex.exe'), 9_000_000)
    // The alphabet says the other way round; the modification time is what decides.
    const found = codexOnWindows().filter((p) => p.startsWith(bin))
    assert.deepEqual(found, [fresh, old])
  })

  it('breaks a tie on the path, so the same disk answers the same way twice', () => {
    const { local } = windowsRoots()
    const bin = path.join(local, 'OpenAI', 'Codex', 'bin')
    const b = file(path.join(bin, 'bbbb', 'codex.exe'), 5_000_000)
    const a = file(path.join(bin, 'aaaa', 'codex.exe'), 5_000_000)
    assert.deepEqual(codexOnWindows().filter((p) => p.startsWith(bin)), [a, b])
  })

  it('tries the four known layouts in the documented order', () => {
    const { local, profile, programs } = windowsRoots()
    const cache = file(path.join(local, 'OpenAI', 'Codex', 'bin', 'abc123', 'codex.exe'))
    const launcher = path.join(local, 'Programs', 'OpenAI', 'Codex', 'bin', 'codex.exe')
    file(launcher)
    const release = file(
      path.join(
        profile,
        '.codex',
        'packages',
        'standalone',
        'releases',
        `1.2.3-${ARCH.target}-pc-windows-msvc`,
        'bin',
        'codex.exe',
      ),
    )
    const packaged = file(
      path.join(programs, 'WindowsApps', `OpenAI.Codex_1.2.3.0_${ARCH.pkg}__abc`, 'app', 'resources', 'codex.exe'),
    )
    assert.deepEqual(discovered(), [cache, launcher, release, packaged])
  })

  it('orders release and package folders by version, not by the alphabet', () => {
    const { profile } = windowsRoots()
    const releases = path.join(profile, '.codex', 'packages', 'standalone', 'releases')
    const nine = file(path.join(releases, `0.9.0-${ARCH.target}-pc-windows-msvc`, 'bin', 'codex.exe'))
    const ten = file(path.join(releases, `0.10.0-${ARCH.target}-pc-windows-msvc`, 'bin', 'codex.exe'))
    assert.deepEqual(codexOnWindows().filter((p) => p.startsWith(releases)), [ten, nine])
  })

  it('drops a folder built for another architecture, and keeps one naming none', () => {
    const { programs } = windowsRoots()
    const apps = path.join(programs, 'WindowsApps')
    const other = process.arch === 'arm64' ? 'x64' : 'arm64'
    file(path.join(apps, `OpenAI.Codex_9.9.9.0_${other}__abc`, 'app', 'resources', 'codex.exe'))
    const plain = file(path.join(apps, 'OpenAI.Codex_1.0.0.0__abc', 'app', 'resources', 'codex.exe'))
    assert.deepEqual(codexOnWindows().filter((p) => p.startsWith(apps)), [plain])
  })

  it('skips everything but Codex under WindowsApps', () => {
    const { programs } = windowsRoots()
    const apps = path.join(programs, 'WindowsApps')
    file(path.join(apps, 'Microsoft.Something_1.0.0.0_x64__abc', 'app', 'resources', 'codex.exe'))
    assert.deepEqual(codexOnWindows().filter((p) => p.startsWith(apps)), [])
  })

  it('answers nothing, rather than failing, when a root is unset, absent or not a folder', () => {
    delete process.env.LOCALAPPDATA
    process.env.USERPROFILE = path.join(root, 'win', 'nobody')
    process.env.ProgramFiles = file(path.join(root, 'win', 'not-a-folder'))
    assert.deepEqual(discovered(), [])
  })

  it('forgets a file the moment it is removed, and finds one added since', () => {
    const { local } = windowsRoots()
    const bin = path.join(local, 'OpenAI', 'Codex', 'bin')
    const first = file(path.join(bin, 'aaaa', 'codex.exe'), 1_000_000)
    assert.deepEqual(discovered(), [first])
    // Desktop updates: a second hashed folder appears, written more recently.
    const second = file(path.join(bin, 'bbbb', 'codex.exe'), 9_000_000)
    assert.deepEqual(discovered(), [second, first])
    // Desktop is uninstalled and takes the new one with it; the leftover stays discoverable.
    fs.rmSync(path.dirname(second), { recursive: true, force: true })
    assert.deepEqual(discovered(), [first])
    fs.rmSync(path.dirname(first), { recursive: true, force: true })
    assert.deepEqual(discovered(), [])
  })
})

describe('what the command ends up being', () => {
  /** A board with one Codex row, so the resolved command can be asked for. */
  function board(): void {
    const kanban = path.join(root, 'docs', 'kanban')
    fs.mkdirSync(kanban, { recursive: true })
    fs.writeFileSync(
      path.join(kanban, 'ui.config.json'),
      JSON.stringify({
        runtimes: [{ id: 'global', name: 'Global default', harness: 'codex', settings: {} }],
      }),
    )
    setBoardRoot(root)
  }

  it('keeps a path holding spaces whole, through every reader of the command', () => {
    board()
    const bundled = file(path.join(root, 'Program Files', 'OpenAI', 'codex'))
    process.env.CODEX_CLI_PATH = bundled
    // Quoted in the command string, because that string is re-split by everything that reads
    // it; one argument again by the time a run is planned.
    assert.equal(commandOf({}, CODEX), `"${bundled}" exec --json --sandbox workspace-write -c sandbox_workspace_write.network_access=true`)
    assert.equal(planRun('s1', root).argv[0], bundled)
  })

  it('leaves a PATH install alone, however much is on disk beside it', () => {
    board()
    onPath('codex')
    process.env.CODEX_CLI_PATH = file(path.join(root, 'elsewhere', 'codex'))
    assert.equal(commandOf({}, CODEX), CODEX.command)
  })

  it('leaves a command that already says where its binary lives', () => {
    board()
    process.env.CODEX_CLI_PATH = file(path.join(root, 'elsewhere', 'codex'))
    assert.equal(commandOf({ command: '/opt/mine/codex exec' }, CODEX), '/opt/mine/codex exec')
  })

  it('passes over a candidate that is not there', () => {
    board()
    const gone = path.join(root, 'gone', 'codex')
    process.env.CODEX_CLI_PATH = gone
    assert.ok(!commandOf({}, CODEX).includes(gone))
  })
})

describe('an executable that will not start', () => {
  const probe = (binary: string): Promise<{ output: string; unrunnable: boolean }> =>
    ask({ harness: CODEX, binary } as Ask)

  it('reads a file it cannot execute as unrunnable', async () => {
    const blocked = path.join(root, 'blocked', 'codex')
    fs.mkdirSync(path.dirname(blocked), { recursive: true })
    fs.writeFileSync(blocked, '', { mode: 0o644 })
    const { unrunnable } = await probe(blocked)
    assert.equal(unrunnable, true)
  })

  it('reads a CLI that answered as runnable, whatever it said about the login', async () => {
    const works = path.join(root, 'works', 'codex')
    fs.mkdirSync(path.dirname(works), { recursive: true })
    fs.writeFileSync(works, '#!/bin/sh\necho "Not logged in"\n', { mode: 0o755 })
    const { output, unrunnable } = await probe(works)
    assert.equal(unrunnable, false)
    assert.equal(readLogin(CODEX, output), 'logged-out')
  })
})
