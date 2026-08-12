import type { Metadata } from "next";
import { DesignSystem } from "./system";

// /design — every token and every block the board ships, on one screen, with the
// measured contrast of each pair it puts in front of a reader. The board's
// counterpart to the site's page (web/app/(en)/design/page.tsx), and it works the
// same way: nothing here declares a style of its own that a screen doesn't — the
// blocks are imported from components/, the classes come from app/globals.css,
// and the colors are read from the same `@theme`. It needs no board: it is a
// static page, so it renders whether or not the server found a docs/kanban/.
//
// The page body is a client component (system.tsx) because half of what it
// shows is interactive — the selects, the dialog, the press states. This file
// stays a server component so the route can carry a title of its own.
//
// The language in four lines:
//
//   The ground is warm — cream page, white paper, a faint wash between them,
//   charcoal ink. Nothing on it is pure black or pure grey.
//
//   The ember is the only voice that raises itself: one accent, used for the
//   thing you are meant to press and the thing that is happening right now.
//
//   A block is a 1.5px ink outline and a hard offset shadow, and it moves when
//   you press it — lift on hover, settle on click.
//
//   The pastels are meaning, not decoration: mint done, sky neutral, lilac a
//   group or a schedule, peach something in the way.

export const metadata: Metadata = {
  title: "Design system · AI4Kanban",
};

export default function DesignPage() {
  return <DesignSystem />;
}
