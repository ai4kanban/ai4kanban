import { execFileSync } from 'node:child_process'

export const PROXY_KEYS = ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy']

/** 宿主传入的代理优先；否则补充 macOS 已启用的手动代理；都没有则直连。每次调用重新读取。 */
export function withSystemProxy(
  env: NodeJS.ProcessEnv = process.env,
  platform: string = process.platform,
  read: () => string = () => execFileSync('/usr/sbin/scutil', ['--proxy'], { encoding: 'utf8', timeout: 1_000, stdio: ['ignore', 'pipe', 'ignore'] }),
): NodeJS.ProcessEnv {
  const out = { ...env }
  if (platform !== 'darwin' || PROXY_KEYS.some((key) => env[key] !== undefined)) return out
  let raw: string
  try { raw = read() } catch { return out }
  const value = (key: string) => new RegExp(`^\\s*${key}\\s*:\\s*(.*?)\\s*$`, 'm').exec(raw)?.[1]
  for (const [name, key, scheme] of [['HTTP', 'HTTP_PROXY', 'http'], ['HTTPS', 'HTTPS_PROXY', 'http'], ['SOCKS', 'ALL_PROXY', 'socks5']] as const) {
    if (value(`${name}Enable`) !== '1') continue
    const host = value(`${name}Proxy`)
    const port = Number(value(`${name}Port`))
    if (!host || /[\s/@?#]/.test(host) || !Number.isInteger(port) || port < 1 || port > 65535) continue
    try {
      out[key] = new URL(`${scheme}://${host.includes(':') && !host.startsWith('[') ? `[${host}]` : host}:${port}`).href.replace(/\/$/, '')
    } catch { /* 无效配置保持直连。 */ }
  }
  if (PROXY_KEYS.some((key) => out[key]) && env.NO_PROXY === undefined && env.no_proxy === undefined) {
    const exceptions = /ExceptionsList\s*:\s*<array>\s*\{([^}]+)\}/.exec(raw)?.[1]
    const bypass = exceptions?.split('\n').flatMap((line) => {
      const host = /^\s*\d+\s*:\s*(\S+)\s*$/.exec(line)?.[1]
      return host ? [host.startsWith('*.') ? host.slice(1) : host] : []
    })
    if (bypass?.length) out.NO_PROXY = bypass.join(',')
  }
  return out
}
