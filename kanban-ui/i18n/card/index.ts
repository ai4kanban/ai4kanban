import type { Language } from "@/lib/types";
import type { CardCopy } from "./types";
import en from "./en";
import zh from "./zh";

/** The card detail page, in every language. */
const copy: Record<Language, CardCopy> = { en, zh };

export default copy;
