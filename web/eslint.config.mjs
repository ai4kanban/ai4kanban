import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const config = [
  { ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // The site is a static export with locale-prefixed hrefs — every
      // internal link is a plain <a> on purpose, so next/link never applies.
      "@next/next/no-html-link-for-pages": "off",
    },
  },
];

export default config;
