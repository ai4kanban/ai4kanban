import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { useRunnerHome } from './home'
import { launch } from './launcher'
import { VERSION } from './protocol'

useRunnerHome()
// The Runner this package ships sits beside this file in dist/.
const entry = path.join(path.dirname(fileURLToPath(import.meta.url)), 'runner.mjs')
launch({ version: VERSION, entry }).then((code) => process.exit(code))
