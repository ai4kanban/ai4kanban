import type { Metadata } from "next";
import { BASE_URL, OG_IMAGE } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: "AI4Kanban — a local task board in Markdown, next to your code",
  description:
    "A Claude Code skill that runs a kanban board for you — your backlog lives as plain Markdown files in git. No database, no MCP.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "AI4Kanban",
    title: "AI4Kanban — a local task board in Markdown, next to your code",
    description:
      "Claude proposes the next work, writes the cards, and archives what's done. You steer the backlog in plain language, straight from your terminal.",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI4Kanban — a local task board in Markdown, next to your code",
    description:
      "Claude proposes the next work, writes the cards, and archives what's done. You steer the backlog in plain language, straight from your terminal.",
    images: [OG_IMAGE.url],
  },
  verification: {
    google: "QVTStPZuK-LT8pPMpHaVrFmpfTGz1Q-zqmdKpkTK8d0",
    other: {
      "msvalidate.01": "521C70143365BD805FB506191691EA77",
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Send *.pages.dev and the old kanbanskill.cc domain to the current one.
            Raw inline script so it runs during HTML parse (no flash, no dependency
            on the JS bundle). Guarded on hostname so it never loops on
            ai4kanban.dev or localhost. Canonical tags handle SEO; this just
            shepherds human visitors. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `if(location.hostname.endsWith(".pages.dev")||location.hostname.endsWith("kanbanskill.cc")){location.replace("https://ai4kanban.dev"+location.pathname+location.search+location.hash)}`,
          }}
        />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
