// How often a recurring card repeats (#139).
//
//   30m          every 30 minutes
//   6h           every 6 hours
//   7d           every 7 days
//   1d at 09:30  every day, at that time of day
//
// `at HH:MM` is allowed only when the interval is whole days — "every 90 minutes
// at 09:30" doesn't mean anything. A card with no cadence runs only when someone
// clicks Run: writing one is the opt-in to background runs.
//
// The parser itself is NOT here. It is cli/src/lib/cadence.ts, copied to
// ./format/cadence.ts by scripts/sync-format.mjs, so the script that writes a
// cadence and the server that acts on one cannot read it differently. This file
// is the name the UI imports it under — fix the rules in cli/src/lib/.
//
// Every time here is the server's own local time. The board is a local tool, so
// there is no other clock to pick — and the dispatcher, the card page and the
// CLI all read the one clock.

export {
  CADENCE_FORMS,
  parseCadence,
  formatCadence,
  formatStamp,
  parseStamp,
  nextDue,
  isDue,
} from "./format/cadence";

export type { Cadence, CadenceUnit } from "./format/cadence";
