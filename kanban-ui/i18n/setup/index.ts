import type { Language } from "@/lib/types";
import type { SetupCopy } from "./types";
import en from "./en";
import zh from "./zh";

/** The first-run setup, in every language. */
const copy: Record<Language, SetupCopy> = { en, zh };

export default copy;
