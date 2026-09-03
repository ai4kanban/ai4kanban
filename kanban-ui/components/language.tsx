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
// The SAVE arrives as a prop rather than being imported (#374). `useCopy()` reads the
// context this file provides, so every screen on the board leads back here — and a static
// import of `@/app/actions` from this one file would put the whole of that file, the coding
// agent and this machine's filesystem with it, in the import closure of every screen there
// is. A caller that hands in no save switches the language for the session and writes
// nothing.
//
// Both halves of this file read their words with `getCopy()` rather than `useCopy()`: a
// component reading the context it provides would get the default, which would leave the
// switcher's own save-failed message English on a Chinese app.

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getCopy } from "@/i18n";
import { Rich } from "@/i18n/rich";
import { DEFAULT_LANGUAGE, LANGUAGE_NAMES, LANGUAGE_TAGS, LANGUAGES, type Language, type WriteResult } from "@/lib/types";
import { Group, Panel } from "./settings";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "./ui/select";

const LanguageContext = createContext<{
  language: Language;
  choose(next: Language): Promise<string | null>;
}>({ language: DEFAULT_LANGUAGE, choose: async () => null });

export function LanguageProvider({
  initial,
  onSave,
  children,
}: {
  initial: Language;
  /** Write the setting down. Left out, a switch holds for this session only. */
  onSave?: (next: Language) => Promise<WriteResult>;
  children: React.ReactNode;
}) {
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
        if (!onSave) return null;
        const saved = await onSave(next);
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
    [language, c, onSave, router],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/** The language this screen draws in. */
export function useLanguage(): Language {
  return useContext(LanguageContext).language;
}

/** The languages this app doesn't speak yet, written in their own names and greyed in the
 *  list. Not `Language` values and never saved: a reader looking for theirs gets an answer
 *  where they look for it, rather than a list of two that says nothing about the rest. */
const COMING_SOON = ["日本語", "Español", "Français"];

/** The **Language** group of Configuration → General: one dropdown, each entry written in
 *  its own name so a reader recognises theirs without knowing the language it is listed in. */
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
      <Panel>
        <div className="flex items-center justify-between gap-5 py-3 max-sm:flex-col max-sm:items-start max-sm:gap-2.5">
          <p className="max-w-[56ch] text-[12px] leading-snug text-nb-ink-soft">
            <Rich>{c.note}</Rich>
          </p>
          <Select
            value={language}
            disabled={saving}
            onValueChange={(next) => void pick(next as Language)}
          >
            <SelectTrigger
              aria-label={c.group}
              className="w-[184px] shrink-0 text-[13px] font-[700] disabled:cursor-wait max-sm:w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((code) => (
                <SelectItem key={code} value={code} lang={LANGUAGE_TAGS[code]}>
                  {LANGUAGE_NAMES[code]}
                </SelectItem>
              ))}
              <SelectSeparator />
              {/* Listed, greyed, unpickable — the value is a stand-in no save ever sees. */}
              {COMING_SOON.map((name) => (
                <SelectItem key={name} value={`soon:${name}`} disabled>
                  <span className="flex items-center gap-2">
                    {name}
                    <span className="text-[10px] font-[700] uppercase tracking-[0.04em] text-nb-ink-soft">
                      {c.comingSoon}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Panel>
    </Group>
  );
}
