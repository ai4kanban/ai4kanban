// Stand-in for the desktop app's preload bridge: only the akb command calls are real.
(() => {
  const LINK = '/tmp/qa-lui-r63/cmdhome/.local/bin/akb'
  const absent = { kind: 'symlink', writes: LINK, needsPassword: false, state: 'absent', points: null, holder: null, otherFirst: null, blocked: null }
  let state = absent
  const known = {
    command: async () => state,
    installCommand: async () => {
      const r = await fetch('http://127.0.0.1:4894/install', { method: 'POST' }).then((x) => x.json())
      state = { ...absent, state: 'installed', points: r.points }
      return { ok: true, state }
    },
    projects: async () => [],
    boards: async () => [],
  }
  window.ai4kanban = new Proxy(known, {
    get(t, k) {
      if (k in t) return t[k]
      if (typeof k === 'string' && /^on[A-Z]/.test(k)) return () => () => {}
      if (k === 'then') return undefined
      return async () => null
    },
  })
})()
