"use client";

// The language the app works in (#334) — where the app holds it, and where you change it.
//
// It is a fact about the reader, not about a board: one answer covers every project you
// open and every terminal on this machine, so it is held outside every repository and
// never in `docs/kanban/`. That is why the switcher sits under the rule in Configuration,
// beside Cloud — everything above that line settles the board.
//
// The answer is read on the server in `app/layout.tsx` and put here, so every screen has it
// in its first paint and none of them draws English and corrects itself. A component reads
// it with `useLanguage()`; nothing threads it as a prop.
//
// Nothing is translated yet — #336 fills the English words in with Chinese ones. What this
// ships is the setting, the switcher, and `<html lang>` following both.

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { FiCheck } from "react-icons/fi";
import { setLanguageAction } from "@/app/actions";
import { DEFAULT_LANGUAGE, LANGUAGE_NAMES, LANGUAGE_TAGS, LANGUAGES, type Language } from "@/lib/types";

const LanguageContext = createContext<{
  language: Language;
  choose(next: Language): Promise<string | null>;
}>({ language: DEFAULT_LANGUAGE, choose: async () => null });

export function LanguageProvider({ initial, children }: { initial: Language; children: React.ReactNode }) {
  const [language, hold] = useState(initial);

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
          return saved.error || "couldn't save that language";
        }
        // The menu bar is outside the page, so the app is told once the setting is safely
        // saved. Absent in a browser, and in an app older than the setting.
        void window.ai4kanban?.languageChanged?.(next);
        return null;
      },
    }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/** The language this screen draws in. */
export function useLanguage(): Language {
  return useContext(LanguageContext).language;
}

/** The **Language** section of the Configuration dialog: two entries, each written in its
 *  own name, so a reader recognises theirs without knowing the other. */
export function LanguagePanel({ onError }: { onError?: (msg: string) => void }) {
  const { language, choose } = useContext(LanguageContext);
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
    <div>
      <div className="mb-5">
        <h3 className="text-[17px] font-[800] tracking-[-0.02em] text-nb-ink">Language</h3>
        <p className="mt-1 max-w-[58ch] text-[13px] leading-relaxed text-nb-ink-soft">
          The language this machine reads in. Saved outside every project, so it follows you
          into every board you open on this machine.
        </p>
      </div>

      <div role="radiogroup" aria-label="Language" className="flex flex-col gap-2">
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
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-[10px] border-[1.5px] px-3 py-2.5 text-left text-[14px] font-[700] transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-nb-accent disabled:cursor-wait ${
                on
                  ? "border-nb-ink bg-nb-accent-soft text-nb-accent-deep"
                  : "border-nb-ink/20 bg-nb-paper text-nb-ink hover:border-nb-ink hover:bg-nb-ink/5"
              }`}
            >
              {LANGUAGE_NAMES[code]}
              {on && <FiCheck className="shrink-0 text-[15px]" aria-hidden />}
            </button>
          );
        })}
      </div>

      <p className="mt-4 max-w-[58ch] text-[12px] leading-relaxed text-nb-ink-soft">
        The board still draws in English — the words are translated in a later release. What
        the <code>akb</code> command prints in a terminal stays English either way.
      </p>
    </div>
  );
}
