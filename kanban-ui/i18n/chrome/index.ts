import type { Language } from "@/lib/types";
import type { ChromeCopy } from "./types";
import en from "./en";
import zh from "./zh";

/** The window's own chrome, in every language. */
const copy: Record<Language, ChromeCopy> = { en, zh };

export default copy;
