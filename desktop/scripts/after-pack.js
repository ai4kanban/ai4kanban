"use strict";

// Put the board server inside the packaged app.
//
// This is what `extraResources` would normally do, and it is done by hand for
// one reason: electron-builder strips `node_modules` out of an extra resource.
// It assumes any node_modules it sees belongs to the app and is resolved from
// the asar — but this one is Next's own bundle for the board server, and
// without it the app ships a server that exits on its first `require`.
//
// electron-builder calls this after packing and BEFORE code signing, so
// everything copied here is signed and notarized with the rest of the app.

const fs = require("node:fs");
const path = require("node:path");

/** Where the app's `resources/` sits, per system. */
function resourcesDir(context) {
  const { appOutDir, electronPlatformName, packager } = context;
  if (electronPlatformName === "darwin") {
    return path.join(appOutDir, `${packager.appInfo.productFilename}.app`, "Contents", "Resources");
  }
  return path.join(appOutDir, "resources");
}

exports.default = async function afterPack(context) {
  const from = path.join(__dirname, "..", "resources", "server");
  if (!fs.existsSync(path.join(from, "server.js"))) {
    throw new Error(
      `after-pack: no board server at ${from} — run \`npm run bundle\` before packaging.`,
    );
  }
  const to = path.join(resourcesDir(context), "server");
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
  if (!fs.existsSync(path.join(to, "node_modules"))) {
    throw new Error(`after-pack: the copy at ${to} has no node_modules — the app would not start.`);
  }
  console.log(`  • board server copied  to=${to}`);
};
