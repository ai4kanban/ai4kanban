import type { Language } from "@/lib/types";
import type { MessagesCopy } from "./types";
import en from "./en";
import zh from "./zh";

/** The sentences the server writes itself, in every language. */
const copy: Record<Language, MessagesCopy> = { en, zh };

export default copy;
