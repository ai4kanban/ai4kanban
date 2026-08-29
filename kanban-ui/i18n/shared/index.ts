import type { Language } from "@/lib/types";
import type { SharedCopy } from "./types";
import en from "./en";
import zh from "./zh";

/** The words more than one screen uses, in every language. */
const copy: Record<Language, SharedCopy> = { en, zh };

export default copy;
