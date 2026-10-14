import type { Metadata } from "next";
import DemoScreen from "@demo/screen";

// The desktop app, walked through one fixed script — the source the home page's board
// screenshots and recordings are taken from. Kept out of search: it's an asset source.
export const metadata: Metadata = {
  title: "AI4Kanban demo",
  robots: { index: false, follow: false },
};

export default function Demo() {
  return <DemoScreen />;
}
