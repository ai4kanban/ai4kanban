import fs from 'node:fs'
import path from 'node:path'
import { runnerHome } from './home'

const directory = () => path.join(runnerHome(), 'executors')
const epochFile = () => path.join(runnerHome(), 'account-generation')
export function accountGeneration(): string {
  try { return fs.readFileSync(epochFile(), 'utf8') } catch { return '' }
}
export function executorRecord(): () => void {
  fs.mkdirSync(directory(), { recursive: true, mode: 0o700 })
  const file = path.join(directory(), `${process.pid}.json`)
  fs.writeFileSync(file, '{}', { mode: 0o600 })
  return () => fs.rmSync(file, { force: true })
}
/** 先封住候补进程，再等待真实执行者完成停止。 */
export async function stopExecutors(): Promise<boolean> {
  fs.mkdirSync(runnerHome(), { recursive: true, mode: 0o700 })
  fs.writeFileSync(epochFile(), `${Date.now()}-${process.pid}`, { mode: 0o600 })
  for (let n = 0; n < 160; n++) {
    const active = fs.existsSync(directory()) ? fs.readdirSync(directory()).filter((name) => {
      try { process.kill(Number(name.split('.')[0]), 0); return true } catch { fs.rmSync(path.join(directory(), name), { force: true }); return false }
    }) : []
    if (!active.length) return true
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  return false
}
