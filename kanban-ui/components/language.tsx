"use client";

// The language the app works in (#334) — where the app holds it, and where you change it.
//
// It is a fact about the reader, not about a board: one answer covers every project you
// open and every terminal on this machine, so it is held outside every repository and
// never in `docs/kanban/`. The switcher is the last group of Configuration → General.
//
// The answer is read on the server in `app/layout.tsx` and put here, so every screen has it
// in its first paint and none of them draws English and corrects itself. A component reads
// it with `useLanguage()`; nothing threads it as a prop.
//
// Both halves of this file read their words with `getCopy()` rather than `useCopy()`: a
// component reading the context it provides would get the default, which would leave the
// switcher's own save-failed message English on a Chinese app.

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { setLanguageAction } from "@/app/actions";
import { getCopy } from "@/i18n";
import { Rich } from "@/i18n/rich";
import { DEFAULT_LANGUAGE, LANGUAGE_NAMES, LANGUAGE_TAGS, LANGUAGES, type Language } from "@/lib/types";
import { Group } from "./settings";

const LanguageContext = createContext<{
  language: Language;
  choose(next: Language): Promise<string | null>;
}>({ language: DEFAULT_LANGUAGE, choose: async () => null });

export function LanguageProvider({ initial, children }: { initial: Language; children: React.ReactNode }) {
  const router = useRouter();
  const [language, hold] = useState(initial);
  const c = getCopy(language).configuration.language;

  // A refresh re-reads the setting on the server. Take what it says, so a save made in
  // another window doesn't leave this one showing the answer it had at first paint.
  useEffect(() => {
    hold(initial);
  }, [initial]);

  // The server tagged <html lang> for the first paint. A change has no reload behind it, so
  // the tag is moved here — screen readers and hyphenation follow it.
  useEffect(() => {
    document.documentElement.lang = LANGUAGE_TAGS[language];
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      // On screen at once and saved behind it, put back when the save fails: a language that
      // silently didn't land is a setting nobody can trust.
      choose: async (next: Language): Promise<string | null> => {
        const was = language;
        hold(next);
        const saved = await setLanguageAction(next);
        if (!saved.ok) {
          hold(was);
          return saved.error || c.saveFailed;
        }
        // Half of what is on screen was rendered on the server in the old language — the
        // window title and the header among it. Asking for a new render is what turns those
        // over with the rest, so the whole screen changes at once and none of it waits for
        // the next launch.
        router.refresh();
        // The menu bar is outside the page, so the app is told once the setting is safely
        // saved. Absent in a browser, and in an app older than the setting.
        void window.ai4kanban?.languageChanged?.(next);
        return null;
      },
    }),
    [language, c, router],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/** The language this screen draws in. */
export function useLanguage(): Language {
  return useContext(LanguageContext).language;
}

/** The **Language** group of Configuration → General: one segmented control, each entry
 *  written in its own name so a reader recognises theirs without knowing the other. */
export function LanguageGroup({ onError }: { onError?: (msg: string) => void }) {
  const { language, choose } = useContext(LanguageContext);
  const c = getCopy(language).configuration.language;
  const caption = getCopy(language).configuration.general.language;
  const [saving, setSaving] = useState(false);

  const pick = async (next: Language) => {
    if (saving || next === language) return;
    setSaving(true);
    try {
      const failed = await choose(next);
      if (failed) onError?.(failed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Group title={caption}>
      <div className="flex items-center justify-between gap-4 py-2.5 max-sm:flex-col max-sm:items-start max-sm:gap-2">
        <p className="max-w-[56ch] text-[12px] leading-snug text-nb-ink-soft">
          <Rich>{c.note}</Rich>
        </p>
        {/* One control, both answers visible — a two-entry dropdown hides half of what
            there is to pick. */}
        <div
          role="radiogroup"
          aria-label={c.group}
          className="flex shrink-0 rounded-[10px] border border-nb-ink/20 bg-nb-paper p-[3px]"
        >
          {LANGUAGES.map((code) => {
            const on = code === language;
            return (
              <button
                key={code}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={saving}
                onClick={() => void pick(code)}
                lang={LANGUAGE_TAGS[code]}
                className={`cursor-pointer rounded-[7px] px-3 py-1.5 text-[13px] font-[700] transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-nb-accent disabled:cursor-wait ${
                  on
                    ? "bg-nb-accent-soft text-nb-accent-deep"
                    : "text-nb-ink-soft hover:bg-nb-ink/[0.06] hover:text-nb-ink"
                }`}
              >
                {LANGUAGE_NAMES[code]}
              </button>
            );
          })}
        </div>
      </div>
    </Group>
  );
}
