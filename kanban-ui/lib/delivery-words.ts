import type { CardCopy } from "@/i18n/card/types";
import type { CardDeliveryState } from "./types";

/** A delivery's pill and line in the reader's language (#1377), with the reason in git's or
 *  the system's own words beside them when the line points at one. A state that names no
 *  kind — an older `akb` — is drawn in its own words. */
export function deliveryWords(
  state: CardDeliveryState,
  c: CardCopy,
): { pill: string; line: string; raw?: string } {
  if (!state.kind) return { pill: state.label, line: state.line };
  const pill =
    state.stage === "landed" ? (state.commit ? c.landed(state.commit) : c.landedNothing) : c.state.pill[state.stage];
  return { pill, line: c.state.line[state.kind](state), raw: state.raw };
}
