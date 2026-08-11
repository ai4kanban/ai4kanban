// Where the things the app carries but did not compile live: the prebuilt board
// server, and the board installer.
//
// Both ride along as resources rather than as code (see electron-builder.yml),
// and both have two homes — inside the packaged app, and in desktop/resources/
// when the app is run from a checkout. That "or else look over here" was written
// out twice before; it is written once here because the second home depends on
// where THIS file ends up, and one copy is one thing to get wrong.

import fs from "node:fs";
import path from "node:path";

// The desktop/ folder itself. This file compiles to out/lib/resources.js (see
// tsconfig.json), so desktop/ is two levels up — the one place that depth is
// written down. Move this file and this line moves with it.
const APP_ROOT = path.join(__dirname, "..", "..");

/** A file the build copied in, wherever it ended up. Prefers the packaged copy,
 *  falls back to the checkout's — so a build from source works before
 *  `npm run bundle` has ever produced a packaged one. */
export function bundledResource(...parts: string[]): string {
  const packaged = path.join(process.resourcesPath || "", ...parts);
  if (fs.existsSync(packaged)) return packaged;
  return path.join(APP_ROOT, "resources", ...parts);
}
