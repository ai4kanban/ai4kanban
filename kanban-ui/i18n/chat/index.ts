import type { Language } from "@/lib/types";
import type { ChatCopy } from "./types";
import en from "./en";
import zh from "./zh";

/** The chat rail, in every language. */
const copy: Record<Language, ChatCopy> = { en, zh };

export default copy;
