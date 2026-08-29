import type { Language } from "@/lib/types";
import type { RunsCopy } from "./types";
import en from "./en";
import zh from "./zh";

/** The runs panel and everything an agent run says, in every language. */
const copy: Record<Language, RunsCopy> = { en, zh };

export default copy;
