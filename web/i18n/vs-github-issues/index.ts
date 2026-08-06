import type { Locale } from "@/lib/i18n";
import type { VsGithubCopy } from "./types";
import en from "./en";
import zh from "./zh";
import es from "./es";
import ja from "./ja";
import fr from "./fr";

/** The words for the GitHub Issues comparison, in every language. */
const copy: Record<Locale, VsGithubCopy> = { en, zh, es, ja, fr };

export default copy;
