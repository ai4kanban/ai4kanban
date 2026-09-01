// What a harness entry has to get right, checked once when the list loads.
//
// Everything here is a mistake in an entry beside this file, never something a user can
// cause: the list is written in this folder and built in, so the person adding a harness is
// the only one who can ever see these. Better a loud failure the moment it's added than a
// setting that quietly overwrites an override, or a picker promising a number the runs
// panel shows a blank for.

import type { Harness } from './types'

// The one key a harness's own block already uses: `command`, the hand-written override for
// its binary and flags. A setting saves beside it, so a setting by that name would fight
// with it.
const RESERVED_SETTING_KEYS = ['command']

export function checkHarnesses(harnesses: Harness[]): void {
  for (const harness of harnesses) {
    // A command either prints or it talks, and the runner asks this file which. Both would
    // be two readers on one stdout; neither would be a run nobody can read.
    if (!harness.renderer === !harness.client) {
      throw new Error(`harness "${harness.name}": declare a renderer for a command that prints, or a client for one that answers back — not both, and not neither`)
    }
    // `reports` is what the picker promises about this connector, and the renderer is what
    // actually delivers it. A renderer that stops reporting a cost while the list still claims
    // one would leave the picker saying nothing is missing while the runs panel shows a blank,
    // so the two are compared here rather than left to drift. Only a renderer can be checked:
    // a client reports from inside a live conversation and has nothing to ask until one is
    // open (agent/wire/acp.ts).
    // The folder is only ever read from, and this probe never runs the agent — any folder
    // answers the one question asked here, which is which numbers the renderer reports.
    const renderer = harness.renderer?.(process.cwd())
    if (renderer) {
      const implemented: Record<Harness['reports'][number], boolean> = {
        cost: Boolean(renderer.costUsd),
        tokens: Boolean(renderer.usage),
        model: Boolean(renderer.model),
      }
      for (const [what, has] of Object.entries(implemented)) {
        const claimed = harness.reports.includes(what as Harness['reports'][number])
        if (claimed !== has) {
          throw new Error(`harness "${harness.name}": its "reports" ${claimed ? 'claims' : 'omits'} ${what}, but its renderer ${has ? 'does' : "doesn't"} report one`)
        }
      }
    }
    // The login probe, for a connector that declares one (#392). Empty output is what a
    // spawn that failed leaves behind and has to read as unknown, so a reading that answers
    // it is an inverted test — one that would put every agent on the machine under a
    // logged-out warning.
    const probe = harness.login
    if (probe) {
      if (!probe.args.length) throw new Error(`harness "${harness.name}": its login probe runs no arguments`)
      if (!probe.login.trim()) throw new Error(`harness "${harness.name}": its login probe names no command that logs the user back in`)
      if (probe.ready('') || probe.loggedOut('')) {
        throw new Error(`harness "${harness.name}": its login probe reads empty output as an answer — a probe that couldn't run has to say nothing`)
      }
    }
    const seen = new Set<string>()
    const seenEnv = new Set<string>()
    for (const setting of harness.settings) {
      const { key } = setting
      if (RESERVED_SETTING_KEYS.includes(key)) {
        throw new Error(`harness "${harness.name}": a setting can't be called "${key}" — that key is the harness block's own`)
      }
      if (seen.has(key)) throw new Error(`harness "${harness.name}": two settings share the key "${key}"`)
      seen.add(key)
      // A secret reaches the run as an environment variable and nothing else: it has to name
      // the variable, that name has to be its own, and it can carry no flag — a key on a
      // command line is a key in every process list on the machine. `envAs` renames it on
      // the way out, so the name a run sees is checked alongside the file's: two secrets
      // landing on one variable is one of them overwriting the other.
      if (setting.kind !== 'secret') continue
      if (!setting.env) throw new Error(`harness "${harness.name}": the secret "${key}" names no environment variable`)
      if (setting.flags?.length) throw new Error(`harness "${harness.name}": the secret "${key}" can't take a flag — a secret reaches the run as ${setting.envAs ?? setting.env}`)
      for (const name of new Set([setting.env, setting.envAs ?? setting.env])) {
        if (seenEnv.has(name)) throw new Error(`harness "${harness.name}": two secrets share the variable "${name}"`)
        seenEnv.add(name)
      }
    }
    // The provider list, checked the same way and for the same reason. A provider that needs
    // a setting the harness never declared would draw an empty box, and a default that names
    // no provider would leave a run with no pick at all.
    const providers = harness.settings.filter((s) => s.kind === 'provider')
    if (providers.length > 1) {
      throw new Error(`harness "${harness.name}": a connector declares one provider list, not ${providers.length}`)
    }
    const list = providers[0]
    if (!list) continue
    if (!list.providers?.length) throw new Error(`harness "${harness.name}": the provider setting "${list.key}" offers no providers`)
    const ids = new Set<string>()
    for (const provider of list.providers) {
      if (ids.has(provider.id)) throw new Error(`harness "${harness.name}": two providers share the id "${provider.id}"`)
      ids.add(provider.id)
      for (const need of [...provider.needs, ...(provider.preferWhenSet ?? [])]) {
        if (!seen.has(need)) throw new Error(`harness "${harness.name}": the provider "${provider.id}" needs a setting "${need}" it never declared`)
      }
      for (const required of provider.requires ?? []) {
        if (!provider.needs.includes(required)) throw new Error(`harness "${harness.name}": the provider "${provider.id}" requires "${required}" without needing it`)
      }
      for (const key of Object.keys(provider.envAs ?? {})) {
        if (!provider.needs.includes(key)) throw new Error(`harness "${harness.name}": the provider "${provider.id}" renames the variable of "${key}" without needing it`)
      }
    }
    if (list.defaultProvider && !ids.has(list.defaultProvider)) {
      throw new Error(`harness "${harness.name}": the default provider "${list.defaultProvider}" isn't on the list`)
    }
  }
}
