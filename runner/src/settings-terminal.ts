import { readSession } from '../../cli/src/lib/cloud/session'
import { closeSettings, openSettings, ownsSettings } from './settings-server'
import { settingsAction, onSettingsChange } from './settings'
import { launch } from './launcher'
import { accountGeneration } from './settings-control'
import { EXIT_OUTDATED, EXIT_REFUSED, VERSION } from './protocol'

export async function terminalSettings(entry: string): Promise<void> {
  const result = await openSettings(settingsAction, { path: process.cwd() })
  process.stdout.write(`${result.url}\n`)
  if (!ownsSettings()) return
  let running: AbortController | null = null
  let done = Promise.resolve()
  let blocked: string | null = null
  const run = () => {
    const session = readSession()
    const account = `${session?.subject}:${accountGeneration()}`
    if (running || !session || blocked === account) return
    running = new AbortController()
    done = launch({ version: VERSION, entry }, { signal: running.signal }).then((code) => { running = null; if (code === EXIT_OUTDATED || code === EXIT_REFUSED) blocked = account })
  }
  onSettingsChange(run)
  const timer = setInterval(run, 1000)
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, async () => {
    clearInterval(timer)
    running?.abort()
    await done
    await closeSettings()
  })
  run()
}
