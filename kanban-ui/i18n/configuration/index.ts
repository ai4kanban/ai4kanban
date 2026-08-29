import type { Language } from "@/lib/types";
import type { ConfigurationCopy } from "./types";
import en from "./en";
import zh from "./zh";

/** The Configuration dialog, in every language. */
const copy: Record<Language, ConfigurationCopy> = { en, zh };

export default copy;
