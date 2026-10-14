import "./demo.css";

// /demo's own root layout: the board app's stylesheet and nothing of the site's. `a4k-inset`
// is the class the desktop app sets on macOS, which leaves the traffic lights their gutter.
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="a4k-inset font-sans antialiased">{children}</body>
    </html>
  );
}
