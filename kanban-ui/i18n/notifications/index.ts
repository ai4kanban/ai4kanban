import type { Language } from "@/lib/types";
import type { NotificationsCopy } from "./types";
import en from "./en";
import zh from "./zh";

/** The notification bell and its rail, in every language. */
const copy: Record<Language, NotificationsCopy> = { en, zh };

export default copy;
