import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // No `outputFileTracingRoot`. Pointing it at the repository moves the standalone build to
  // `.next/standalone/cloud-ui/`, and OpenNext reads `.next/standalone/` — it works out its
  // own root from the nearest lockfile, which is this folder, and the two disagreeing is a
  // build that dies on a missing pages-manifest.json. `transpilePackages` below is what
  // carries ../kanban-ui in, so the wider root buys nothing.
  // The board screen and a card page are TypeScript in ../kanban-ui, and Next compiles
  // source outside its own folder only for a package it is told to transpile. That tree is
  // this app's `ai4kanban-ui` dependency (`file:../kanban-ui`) for exactly this reason — no
  // copy of the components, and no hand-written loader rule to keep working across upgrades.
  transpilePackages: ["ai4kanban-ui"],
  webpack: (config) => {
    // ONE copy of React and Next. A file under ../kanban-ui resolves its packages by walking
    // up from itself, so a dev checkout that has installed that tree would hand the screens a
    // second React and a second router — two of either and every hook throws. Searching this
    // app's own `node_modules` first is what keeps both sides on one copy, and it is one rule
    // rather than a list of packages somebody has to keep up to date.
    config.resolve.modules = [
      path.join(here, "node_modules"),
      ...(config.resolve.modules ?? ["node_modules"]),
    ];
    return config;
  },
};

export default nextConfig;
