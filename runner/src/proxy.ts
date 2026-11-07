// The Runner's own requests follow the proxy the host passed in, else the system's, re-read
// so a proxy turned on, off or moved applies without a restart. undici carries every fetch
// and WebSocket in the process, so this holds on every supported Node, not only 24.14+.

import { EnvHttpProxyAgent, install, setGlobalDispatcher } from 'undici'
import { PROXY_KEYS, withSystemProxy } from '../../cli/src/lib/agent/proxy'

const LOOPBACK = 'localhost,127.0.0.1,[::1]'
/** The host's own proxy variables, handed to an akb the Runner starts (#435): its env also
 *  carries the system's, which must stay re-readable. */
export const HOST_PROXY_ENV = 'WILDCRANE_HOST_PROXY'
// Taken on first use, after `proxy.env` is loaded.
let HOST: NodeJS.ProcessEnv | null = null
let current: NodeJS.ProcessEnv = {}
let applied: string | null = null

export function hostProxy(): NodeJS.ProcessEnv {
  if (HOST) return HOST
  try {
    if (process.env[HOST_PROXY_ENV]) return (HOST = JSON.parse(process.env[HOST_PROXY_ENV]!) as NodeJS.ProcessEnv)
  } catch {
    // Fall back to this process's own variables.
  }
  return (HOST = Object.fromEntries(
    [...PROXY_KEYS, 'NO_PROXY', 'no_proxy'].flatMap((key) => (process.env[key] === undefined ? [] : [[key, process.env[key]]])),
  ))
}

export function followProxy(read?: () => string): NodeJS.ProcessEnv {
  current = read ? withSystemProxy(hostProxy(), process.platform, read) : withSystemProxy(hostProxy())
  const httpProxy = current.HTTP_PROXY || current.http_proxy || current.ALL_PROXY || current.all_proxy || undefined
  const route = {
    httpProxy,
    httpsProxy: current.HTTPS_PROXY || current.https_proxy || httpProxy,
    noProxy: [current.NO_PROXY ?? current.no_proxy, LOOPBACK].filter(Boolean).join(','),
  }
  const key = JSON.stringify(route)
  if (key !== applied) {
    if (applied === null) install()
    // New requests take the new route; open connections finish on the old one.
    setGlobalDispatcher(new EnvHttpProxyAgent(route))
    applied = key
  }
  return current
}

/** The proxy variables in force, for a child process. */
export function proxyEnv(): NodeJS.ProcessEnv {
  return current
}
