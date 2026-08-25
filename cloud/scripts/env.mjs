import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const serviceRoot = dirname(dirname(fileURLToPath(import.meta.url)))

/** The shell's environment, filled in from cloud/.env, which is not in git. */
export async function loadEnv() {
  let text = ''
  try {
    text = await readFile(join(serviceRoot, '.env'), 'utf8')
  } catch {
    // No file is normal: the values may come from the shell.
  }
  const values = {}
  for (const line of text.split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line)
    if (match) values[match[1]] = match[2].trim().replace(/^["']|["']$/g, '')
  }
  return { ...values, ...withoutBlanks(process.env) }
}

export function requireEnv(env, ...names) {
  const missing = names.filter((name) => !env[name])
  if (missing.length > 0) {
    throw new Error(`set ${missing.join(' and ')}, in the environment or in cloud/.env`)
  }
  return names.map((name) => env[name])
}

const withoutBlanks = (source) =>
  Object.fromEntries(Object.entries(source).filter(([, value]) => value))
