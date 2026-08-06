import type { Locale } from "@/lib/i18n";
import type { SharedCopy } from "./types";
import en from "./en";
import zh from "./zh";
import es from "./es";
import ja from "./ja";
import fr from "./fr";

/** The words for the chrome every page shares, in every language. */
const copy: Record<Locale, SharedCopy> = { en, zh, es, ja, fr };

export default copy;
