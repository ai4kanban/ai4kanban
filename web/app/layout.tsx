import type { Metadata } from "next";
import {
  HOME_DESCRIPTION,
  HOME_SOCIAL,
  HOME_TITLE,
  pageMetadata,
} from "@/lib/metadata";
import { BASE_URL } from "@/lib/site";
import "./globals.css";

// No `keywords`: <meta name="keywords"> has been ignored by Google since 2009
// and is read as a spam signal elsewhere. What the site is about is carried by
// the title, the description, and the JSON-LD entity in app/page.tsx.
export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  ...pageMetadata({
    path: "",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    social: HOME_SOCIAL,
  }),
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
