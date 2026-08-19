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
  const resources = resourcesDir(context);

  const from = path.join(__dirname, "..", "resources", "server");
  if (!fs.existsSync(path.join(from, "server.js"))) {
    throw new Error(
      `after-pack: no board server at ${from} — run \`npm run bundle\` before packaging.`,
    );
  }
  const to = path.join(resources, "server");
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
  if (!fs.existsSync(path.join(to, "node_modules"))) {
    throw new Error(`after-pack: the copy at ${to} has no node_modules — the app would not start.`);
  }
  console.log(`  • board server copied  to=${to}`);

  // And the board installer (scripts/bundle-cli.mjs), so the app can make a
  // board in a folder that has none. It rides here for the same reason: a Node
  // program that reads its own files, which can't be done out of an asar.
  const cliFrom = path.join(__dirname, "..", "resources", "cli");
  if (!fs.existsSync(path.join(cliFrom, "bin", "ai4kanban.mjs"))) {
    throw new Error(
      `after-pack: no board installer at ${cliFrom} — run \`npm run bundle\` before packaging.`,
    );
  }
  const cliTo = path.join(resources, "cli");
  fs.rmSync(cliTo, { recursive: true, force: true });
  fs.cpSync(cliFrom, cliTo, { recursive: true });
  console.log(`  • board installer copied  to=${cliTo}`);

  // And the `akb` launcher (#226) — the file /usr/local/bin/akb is a symlink to, and the
  // folder Windows puts on the PATH. It rides here rather than in `extraResources` so it
  // is inside the bundle before signing, like everything else the app carries.
  const binFrom = path.join(__dirname, "..", "resources", "bin");
  const binTo = path.join(resources, "bin");
  fs.rmSync(binTo, { recursive: true, force: true });
  fs.cpSync(binFrom, binTo, { recursive: true });
  // The executable bit is what makes it a command rather than a text file, and it does not
  // survive every way a checkout reaches a build machine.
  for (const name of ["akb"]) {
    const file = path.join(binTo, name);
    if (fs.existsSync(file)) fs.chmodSync(file, 0o755);
  }
  console.log(`  • akb launcher copied  to=${binTo}`);
};
