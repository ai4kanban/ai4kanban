import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const REVIEW = decodeURIComponent(new URL("./src/review", import.meta.url).pathname);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@review": REVIEW } },
  build: { chunkSizeWarningLimit: 1500 },
});
