import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The screens live in ../kanban-ui, so the tracer's root is the repository rather than
  // this folder — without it the build refuses to follow an import out of the app.
  outputFileTracingRoot: path.join(here, ".."),
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
