import type { Language } from "@/lib/types";
import type { TourCopy } from "./types";
import en from "./en";
import zh from "./zh";

/** The welcome tour, in every language. */
const copy: Record<Language, TourCopy> = { en, zh };

export default copy;
