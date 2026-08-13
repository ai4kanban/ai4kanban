import type { Metadata } from "next";
import { NavEdge } from "@/components/desktop";
import { insetTitleBar, isDesktop } from "@/lib/desktop";
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
  title: "AI4Kanban",
  description: "Local kanban board — spawn agents to do the work.",
  icons: { icon: ICON },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // In the app on macOS the window has no title bar and this page is it — the
  // class is what turns the gutter and the drag region on (app/globals.css).
  const inset = insetTitleBar();
  const desktop = isDesktop();
  return (
    <html lang="en">
      <body className={`font-sans antialiased${inset ? " a4k-inset" : ""}`}>
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
      </body>
    </html>
  );
}
