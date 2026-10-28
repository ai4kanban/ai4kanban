import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const path = (to: string) => decodeURIComponent(new URL(to, import.meta.url).pathname);
const REVIEW = path("../review/src");
const HERE = path("./src/main.tsx");

// review/src is imported as is; its bare imports resolve from this app's node_modules.
const reviewDeps: Plugin = {
  name: "review-deps",
  enforce: "pre",
  resolveId(id, importer, options) {
    if (!importer?.startsWith(REVIEW) || /^[./\0]/.test(id) || id.startsWith("@review/")) return null;
    return this.resolve(id, HERE, { ...options, skipSelf: true });
  },
};

export default defineConfig({
  plugins: [reviewDeps, react(), tailwindcss()],
  resolve: { alias: { "@review": REVIEW }, dedupe: ["react", "react-dom"] },
  server: { fs: { allow: [".", REVIEW] } },
  build: { chunkSizeWarningLimit: 1500 },
});
