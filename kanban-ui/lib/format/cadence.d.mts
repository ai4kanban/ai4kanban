// Types for ./cadence.mjs, which is copied from skill/lib/ and carries none of
// its own (see scripts/sync-format.mjs). Hand-written and NOT overwritten by the
// sync — a new export there needs a new line here before the UI can see it.

/** The accepted forms, in the words the error messages use. */
export declare const CADENCE_FORMS: string;

/** The units a cadence counts in. */
export type CadenceUnit = "m" | "h" | "d";

export interface Cadence {
  /** How many units between runs — a whole number, 1 or more. */
  n: number;
  unit: CadenceUnit;
  /** The time of day it runs at, `HH:MM`, or empty when it names none. Only a
   *  whole-day cadence can carry one. */
  at: string;
}

/** Read a cadence line, or null when the text isn't one of the accepted forms.
 *  Null is also what an empty field gives: no cadence, so no background runs. */
export declare function parseCadence(raw: unknown): Cadence | null;

/** A parsed cadence back as the one line the card carries. */
export declare function formatCadence(c: Cadence): string;

/** A minute stamp — `2026-08-02 14:31`, local time. What `last_run` holds. */
export declare function formatStamp(d: Date): string;

/** Read a `YYYY-MM-DD HH:MM` stamp as a local Date, or null if it isn't one. */
export declare function parseStamp(raw: unknown): Date | null;

/** When this card is next due, from the run it last recorded. Null means never —
 *  the card has no cadence, so it only runs when a human says so. */
export declare function nextDue(lastRun: string, cadence: string | Cadence | null): Date | null;

/** True when this card's cadence has elapsed and it should run again. */
export declare function isDue(lastRun: string, cadence: string, now?: Date): boolean;
