/** @type {import('next').NextConfig} */
const nextConfig = {
  // This app is NOT a static export — it runs a small Node server so its server
  // actions can read docs/kanban/, spawn `claude -p`, and write cards. Run it
  // locally with `next dev` (or `next build && next start`). No hosting.
  reactStrictMode: true,
  // Ship a self-contained server so `npx ai4kanban-ui` boots the prebuilt app
  // straight from the npm cache instead of compiling on the user's machine. The
  // build writes .next/standalone/server.js plus its own minimal node_modules;
  // the bin script (bin/kanban-ui.mjs) launches it. See references/local-ui.md.
  output: "standalone",
};

export default nextConfig;
