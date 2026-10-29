import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const serviceRoot = dirname(dirname(fileURLToPath(import.meta.url)))

/** `--env staging` (#2198): the staging Worker and Supabase project. */
const args = process.argv.slice(2)
export const staging = args.includes('--env=staging') || args.some((arg, i) => arg === 'staging' && args[i - 1] === '--env')

/** cloud/.env, or cloud/.env.staging for staging; neither is in git. */
export const envFile = staging ? '.env.staging' : '.env'

/** The shell's environment, filled in from the env file. Staging reads the file alone, so a
 *  production value left in the shell never reaches staging. */
export async function loadEnv(file = join(serviceRoot, envFile)) {
  let text = ''
  try {
    text = await readFile(file, 'utf8')
  } catch {
    // No file is normal: the values may come from the shell.
  }
  const values = {}
  for (const line of text.split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line)
    if (match) values[match[1]] = match[2].trim().replace(/^["']|["']$/g, '')
  }
  return staging ? values : { ...values, ...withoutBlanks(process.env) }
}

export function requireEnv(env, ...names) {
  const missing = names.filter((name) => !env[name])
  if (missing.length > 0) {
    throw new Error(`set ${missing.join(' and ')}, ${staging ? 'in' : 'in the environment or in'} cloud/${envFile}`)
  }
  return names.map((name) => env[name])
}

const withoutBlanks = (source) =>
  Object.fromEntries(Object.entries(source).filter(([, value]) => value))
