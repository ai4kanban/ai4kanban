// The two lines every bundle here opens with.
//
// The output is ESM and one of the bundled dependencies (commander) is CommonJS, so the
// `require` esbuild leaves behind for it has to exist. esbuild's own helper prefers a
// `require` already in scope, so defining one is the whole fix.
export const REQUIRE_SHIM = [
  "import { createRequire as __ai4kanbanRequire } from 'node:module'",
  'const require = __ai4kanbanRequire(import.meta.url)',
].join('\n')
