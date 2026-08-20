/** @type {import('next').NextConfig} */
const nextConfig = {
  // This app is NOT a static export — it runs a small Node server so its server
  // actions can read docs/kanban/, spawn `claude -p`, and write cards. Run it
  // locally with `next dev` (or `next build && next start`). No hosting.
  reactStrictMode: true,
  // Ship a self-contained server so `npx ai4kanban-ui` boots the prebuilt app
  // straight from the npm cache instead of compiling on the user's machine. The
  // build writes .next/standalone/server.js plus its own minimal node_modules;
  // the bin script (bin/kanban-ui.mjs) launches it. See `akb guide local-ui`.
  output: "standalone",
  // Tailwind's own stylesheet is read at runtime, not imported, because a mockup's styling
  // is worked out when the mockup is shown rather than when the app was built (#239). The
  // tracer only follows imports, so the file is named here — without it a mockup drawn on
  // a machine that never installed anything would come up unstyled.
  outputFileTracingIncludes: {
    "/**": ["./node_modules/tailwindcss/index.css"],
  },
  // TEMP (screenshot preview): separate dist dir so a dev server can run beside
  // the production one without clobbering .next. Reverted after use.
  ...(process.env.KANBAN_UI_DIST_DIR ? { distDir: process.env.KANBAN_UI_DIST_DIR } : {}),
};

export default nextConfig;
