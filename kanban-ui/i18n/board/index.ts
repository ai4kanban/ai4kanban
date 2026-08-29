import type { Language } from "@/lib/types";
import type { BoardCopy } from "./types";
import en from "./en";
import zh from "./zh";

/** The board screen, in every language. */
const copy: Record<Language, BoardCopy> = { en, zh };

export default copy;
