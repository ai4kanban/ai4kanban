import type { Metadata } from "next";
import { NavEdge } from "@/components/desktop";
import { copy } from "@/i18n";
import { LanguageProvider } from "@/components/language";
import { insetTitleBar, isDesktop } from "@/lib/desktop";
import { machineLanguage } from "@/lib/language";
import { DEFAULT_LANGUAGE, LANGUAGE_TAGS } from "@/lib/types";
import "./globals.css";
import "./markdown.css";

// The tab icon is the same mark as `components/Logo.tsx`, in this app's ember
// rather than the site's azure, inlined rather than served: the board runs from
// a local dev server with no `public/`, and a data URI keeps it to zero
// requests and zero files. Same three columns as web/public/logo-mark.svg, and
// the same bare block the header wears — no ink frame, no shadow. Those are the
// site's mark; a 16px tab is the last place either survives.
const ICON =
  "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>" +
  "<rect width='64' height='64' rx='15' fill='%23dd4f1e'/>" +
  "<g transform='translate(12.16 12.16) scale(0.661)' fill='%23ffffff'>" +
  "<rect x='5' y='8' width='12' height='44' rx='3.5'/>" +
  "<rect x='24' y='8' width='12' height='35' rx='3.5'/>" +
  "<rect x='43' y='8' width='12' height='26' rx='3.5'/>" +
  "</g></svg>";

export const metadata: Metadata = {
  title: copy.chrome.window.title,
  description: copy.chrome.window.description,
  icons: { icon: ICON },
};

// The language is read per request, so a switch takes effect on the next paint rather
// than at the next build. Every board page under this layout already declares this for the
// same reason: the board is a local server reading files that change under it.
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // In the app on macOS the window has no title bar and this page is it — the
  // class is what turns the gutter and the drag region on (app/globals.css).
  const inset = insetTitleBar();
  const desktop = isDesktop();
  // Which language every screen draws in (#334). Read here rather than per page, so all
  // six have it in their first paint and none of them draws English and corrects itself.
  // Nothing to read it with reads as English: a preference is not worth a crash screen.
  const language = await machineLanguage().catch(() => DEFAULT_LANGUAGE);
  return (
    <html lang={LANGUAGE_TAGS[language]}>
      <body className={`font-sans antialiased${inset ? " a4k-inset" : ""}`}>
        {/* Every screen reads the language from here with `useLanguage()`, so none of them
            takes it as a prop and a change re-renders the app without a reload. */}
        <LanguageProvider initial={language}>
          {/* The window has to be movable from every page, including the ones
              with no header — "there is no board here" is a whole screen with no
              top row on it. So the strip, not the header, is what makes the top
              of the window draggable; the header paints over it and cuts its own
              controls back out. */}
          {inset && <div aria-hidden className="a4k-drag-strip" />}
          {/* The mark a move between views leaves down the edge it left by. Here
              rather than on a page, because the move is between pages and the
              mark has to outlive the one it started on. Only in the app: a
              browser draws its own. */}
          {desktop && <NavEdge />}
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
