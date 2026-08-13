// The provider a connector talks to — who pays for a run and where it goes. The pick
// decides two things: which of the connector's other settings are shown at all, and the
// whole environment a run starts under.
//
// The rules are NOT here. They are `cli/src/lib/agent/providers.ts`, copied to
// ./format/agent/providers.ts by scripts/sync-format.mjs. Both sides need the same answers
// and neither can call the other: the CLI resolves the pick into a run's environment, and
// the Configuration dialog draws the fields that pick needs while the user is still typing,
// in a browser that can't read a file. Fix them in cli/src/lib/agent/.

export {
  defaultProviderId,
  missingRequired,
  pickedProvider,
  providerOwned,
  providerSetting,
  shownForProvider,
} from "./format/agent/providers";
