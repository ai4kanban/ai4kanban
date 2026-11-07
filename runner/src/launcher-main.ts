import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { useRunnerHome } from './home'
import { launch } from './launcher'
import { terminalSettings } from './settings-terminal'
import { VERSION } from './protocol'

useRunnerHome()
// The Runner this package ships sits beside this file in dist/.
const entry = path.join(path.dirname(fileURLToPath(import.meta.url)), 'runner.mjs')
if (process.argv.includes('--settings')) {
  terminalSettings(entry).catch(() => { process.stderr.write('无法打开本机设置，请重试。\n'); process.exitCode = 1 })
} else launch({ version: VERSION, entry }).then((code) => process.exit(code))
