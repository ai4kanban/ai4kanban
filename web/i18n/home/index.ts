import type { Locale } from "@/lib/i18n";
import type { HomeCopy } from "./types";
import en from "./en";
import zh from "./zh";
import es from "./es";
import ja from "./ja";
import fr from "./fr";

/** The words for the landing page, in every language. */
const copy: Record<Locale, HomeCopy> = { en, zh, es, ja, fr };

export default copy;
