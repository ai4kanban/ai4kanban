import type { Language } from "@/lib/types";
import type { RailCopy } from "./types";
import en from "./en";
import zh from "./zh";

/** The rail, the memory pages, the goal and Insights, in every language. */
const copy: Record<Language, RailCopy> = { en, zh };

export default copy;
