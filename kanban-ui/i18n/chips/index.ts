import type { Language } from "@/lib/types";
import type { ChipsCopy } from "./types";
import en from "./en";
import zh from "./zh";

/** The chips a card wears, in every language. */
const copy: Record<Language, ChipsCopy> = { en, zh };

export default copy;
