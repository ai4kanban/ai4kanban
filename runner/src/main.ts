// The Runner itself: sign in once, then stay connected and run what Cloud sends.
// Started by the launcher (launcher.ts), which tells it apart from a crash by its exit code.

import { readSession } from '../../cli/src/lib/cloud/session'
import { machineId, machineName, useRunnerHome } from './home'
import { status, t } from './i18n'
import { EXIT_OUTDATED, EXIT_REFUSED, EXIT_UPDATE, VERSION } from './protocol'
import { detectRuntimes } from './runtimes'
import { startRunner } from './connect'
import { signIn } from './signin'

const tell = (message: unknown) => process.send?.(message)

async function main(): Promise<void> {
  useRunnerHome()
  if (!readSession()) {
    const failure = await signIn()
    if (failure) {
      status(t.signInFailed(failure.detail))
      process.exit(EXIT_REFUSED)
    }
    status(t.signedIn())
  }
  tell({ type: 'started' })

  const id = machineId()
  const runner = startRunner({
    registration: async () => ({ machineId: id, machineName: machineName(), version: VERSION, runtimes: await detectRuntimes(true) }),
    kind: process.env.WILDCRANE_RUNNER_KIND === 'codex' ? 'codex' : process.env.WILDCRANE_RUNNER_KIND === 'claude-code' ? 'claude-code' : 'terminal',
    onConnected: () => tell({ type: 'connected' }),
    onWaiting: () => tell({ type: 'waiting' }),
    // Tests shorten the job poll, which stands in when Realtime is out of reach.
    pollMs: Number(process.env.WILDCRANE_POLL_MS) || undefined,
  })

  process.on('message', (message: { type?: string }) => {
    if (message.type === 'renew') return runner.renew()
    if (message.type !== 'update') return
    status('正在更新 Runner，重启后自动恢复任务…')
    void runner.update().then(() => process.exit(EXIT_UPDATE)).catch((error) => { status(String(error)); tell({ type: 'update-deferred' }) })
  })

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, async () => {
      await runner.close()
      status(t.stopped())
      process.exit(0)
    })
  }

  const stop = await runner.stopped
  if (stop.reason === 'outdated') {
    status(t.outdated())
    process.exit(EXIT_OUTDATED)
  }
  status(stop.reason === 'elsewhere' ? t.elsewhere(stop.machine) : t.refused(stop.message))
  process.exit(EXIT_REFUSED)
}

void main()
