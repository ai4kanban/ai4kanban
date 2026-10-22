import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// The screens this app draws are ../kanban-ui's and are linted there. This pass covers this
// app's own files and nothing else.
const config = [
  { ignores: [".next/**", ".open-next/**", "next-env.d.ts"] },
  ...nextVitals,
  ...nextTs,
];

export default config;
