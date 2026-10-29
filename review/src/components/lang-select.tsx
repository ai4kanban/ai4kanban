// 中文 / English, kept in this browser and on the account; picking one reloads the page in it.
// Shared with web/.

import { FiChevronDown } from "react-icons/fi";
import { saveLang } from "../api";
import { COPY, LANG, pickLang, type Lang } from "../i18n";
import { cn } from "../lib/utils";

export function LangSelect({ phone }: { phone?: boolean }) {
  return (
    <span className="relative inline-flex">
      <select
        value={LANG}
        onChange={(e) => {
          const lang = e.target.value as Lang;
          void saveLang(lang).catch(() => {}).finally(() => pickLang(lang));
        }}
        aria-label={COPY.user.language}
        className={cn(
          "nb-field cursor-pointer appearance-none rounded-[8px] border border-nb-ink/25 bg-nb-paper pl-2.5 pr-7 text-nb-ink focus:outline-none",
          phone ? "h-8 text-[16px] font-[500]" : "h-7 text-[12.5px] font-[600]",
        )}
      >
        <option value="zh">中文</option>
        <option value="en">English</option>
      </select>
      <FiChevronDown size={12} aria-hidden className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-nb-ink-soft" />
    </span>
  );
}
