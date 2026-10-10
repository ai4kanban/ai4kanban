import type { Locale } from "@/lib/i18n";
import type { VsOrcaCopy } from "./types";
import en from "./en";
import zh from "./zh";
import es from "./es";
import ja from "./ja";
import fr from "./fr";

const copy: Record<Locale, VsOrcaCopy> = { en, zh, es, ja, fr };

export default copy;
