import type { HarnessSetting, Provider } from "./types";

// --- the provider a connector talks to (#95) --------------------------------
// A connector ships a list of providers — who pays for a run and where it goes —
// and the dialog shows that list as one setting. The pick decides two things:
// which of the connector's other settings are shown at all, and the whole
// environment a run starts under.
//
// These rules live here, as plain functions over the declared data, because both
// sides need the same answers and neither can call the other: the server
// resolves the pick into a run's environment (lib/agent.ts), and the dialog
// draws the fields that pick needs (components/Configuration.tsx), which runs in
// a browser and can't read a file.
//
// Every function takes a `filled` predicate rather than reading anything itself:
// on the server "filled" means the value is in ui.config.json or the variable is
// in docs/kanban/.env, in the browser it means the box has something in it, and
// the rules are the same either way.

/** The provider list a connector declares, or nothing when it declares none —
 *  then it has no providers and every setting it has is always shown. */
export function providerSetting(settings: HarnessSetting[]): HarnessSetting | undefined {
  return settings.find((s) => s.kind === "provider");
}

/** True when this setting belongs to the provider list — some provider names it
 *  in `needs`. Such a setting is shown, and reaches a run, only while a provider
 *  that needs it is picked. A setting no provider names (the model, how hard it
 *  thinks) is always shown and always applies. */
export function providerOwned(settings: HarnessSetting[], key: string): boolean {
  return !!providerSetting(settings)?.providers?.some((p) => p.needs.includes(key));
}

/** The provider a board that has never picked one runs under: the setting's own
 *  default, unless another provider wins because the fields it names are already
 *  filled in. That second rule is what keeps a board that saved a key before the
 *  list existed running on that key instead of quietly dropping it. */
export function defaultProviderId(
  setting: HarnessSetting,
  filled: (key: string) => boolean,
): string {
  const providers = setting.providers ?? [];
  const preferred = providers.find((p) => p.preferWhenSet?.length && p.preferWhenSet.every(filled));
  return preferred?.id ?? setting.defaultProvider ?? providers[0]?.id ?? "";
}

/** The provider in effect: the one the file names, when it names one this build
 *  ships, and the default otherwise. A missing pick and a hand-typed id we don't
 *  know both read as the default, so the dialog and the run always agree on one
 *  of the listed providers rather than on nothing. */
export function pickedProvider(
  setting: HarnessSetting,
  saved: string,
  filled: (key: string) => boolean,
): Provider | undefined {
  const providers = setting.providers ?? [];
  const id = providers.some((p) => p.id === saved) ? saved : defaultProviderId(setting, filled);
  return providers.find((p) => p.id === id);
}

/** The keys this provider must have filled in but doesn't — what stands between
 *  the user and saving the pick. Empty means the pick can be saved. */
export function missingRequired(
  provider: Provider | undefined,
  filled: (key: string) => boolean,
): string[] {
  return (provider?.requires ?? []).filter((key) => !filled(key));
}

/** True when this setting shows for the picked provider, and so reaches a run:
 *  every setting no provider owns, plus the ones this provider needs. */
export function shownForProvider(
  settings: HarnessSetting[],
  key: string,
  provider: Provider | undefined,
): boolean {
  return !providerOwned(settings, key) || !!provider?.needs.includes(key);
}
