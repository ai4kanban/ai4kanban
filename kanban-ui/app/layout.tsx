import type { Metadata, Viewport } from "next";
import { setLanguageAction } from "@/app/actions";
import { AppActions } from "@/components/app-actions";
import { CardOpening } from "@/components/card-opening";
import { NavEdge, SwipeBack } from "@/components/desktop";
import { DropGuard } from "@/components/drop-guard";
import { getCopy } from "@/i18n";
import { LanguageProvider } from "@/components/language";
import { TipHold } from "@/components/tip-hold";
import { AgentTitlesProvider } from "@/lib/agent-name";
import { agentTitles } from "@/lib/agents";
import { insetTitleBar, isDesktop } from "@/lib/desktop";
import { machineLanguage } from "@/lib/language";
import { TAB_ICON } from "@/lib/tab-icon";
import { DEFAULT_LANGUAGE, LANGUAGE_TAGS } from "@/lib/types";
import "./globals.css";
import "./markdown.css";

// A phone renders the board at its own width (#357). Without this it lays the page out at
// desktop width and shrinks the result, which is the whole reason the text was unreadable —
// every rule below `md` never matched, so none of the phone layout would ever be drawn.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// Read per request rather than fixed at build, so the window's own title follows a language
// change along with everything under it — a constant here would keep the title the app was
// launched in until the next launch.
export async function generateMetadata(): Promise<Metadata> {
  const c = getCopy(await machineLanguage().catch(() => DEFAULT_LANGUAGE));
  return {
    title: c.chrome.window.title,
    description: c.chrome.window.description,
    icons: { icon: TAB_ICON },
  };
}

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
  // And what every agent that is a file is called in it (#756). Read here for the same
  // reason the language is: the office nameplate and the runs list name agents from it, and
  // a language change refreshes this layout, so the names turn over with the rest of the
  // words. A board that cannot be read names nothing, and the screens spell the ids.
  const titles = await agentTitles().catch(() => ({}));
  return (
    <html lang={LANGUAGE_TAGS[language]}>
      <body className={`font-sans antialiased${inset ? " a4k-inset" : ""}`}>
        {/* Every screen reads the language from here with `useLanguage()`, so none of them
            takes it as a prop and a change re-renders the app without a reload. */}
        <LanguageProvider initial={language} onSave={setLanguageAction}>
        {/* And what every screen calls an agent (#756) — one lookup, so the office
            nameplate, the runs list, the Agents pane and a workflow's stages can never say
            three different things about one agent. */}
        <AgentTitlesProvider titles={titles}>
        {/* What every screen the app serves can DO (#374). Here rather than on the two board
            pages: the runs panel in the top row acts through it too, and that row is on the
            memory, archive and mockup pages as well. */}
        <AppActions>
          {/* A file dropped anywhere the app has no use for it does nothing (#511) — here
              rather than on a screen, because what it guards is the window. */}
          <DropGuard />
          <CardOpening />
          <TipHold />
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
          {/* And what that move leaves first: a view laid over the page goes before the
              page does (#526). Here for the same reason — the gesture is answered wherever
              it is made. */}
          {desktop && <SwipeBack />}
          {children}
        </AppActions>
        </AgentTitlesProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
