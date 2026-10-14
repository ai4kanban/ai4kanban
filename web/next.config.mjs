import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const kanbanUi = path.join(path.dirname(here), 'kanban-ui') + path.sep;
const demo = path.join(here, 'app', '(demo)', 'demo');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emit a fully static site into `out/` — no Node server needed (Cloudflare Pages).
  output: 'export',
  // Static export can't use the default Image Optimization server.
  images: { unoptimized: true },
  // Emit `/path.html` so clean slash-free URLs work on static hosts.
  trailingSlash: false,
  // `lib/usage.ts` imports `telemetry/contract.ts`, which is outside this folder. The site
  // and the service read the one file rather than each keeping a copy, so a field renamed
  // on one side alone cannot lose a number in silence.
  experimental: { externalDir: true },
  // /demo draws the board app's own screens (`ai4kanban-ui`, `file:../kanban-ui`). Their
  // stylesheet and packages come from kanban-ui's own install, so run `npm install` there too.
  transpilePackages: ['ai4kanban-ui'],
  webpack: (config, { webpack }) => {
    // kanban-ui's source takes this app's packages first: one Next across both trees. Only its
    // source — the site's own packages keep their nested versions.
    config.module.rules.push({
      include: kanbanUi,
      exclude: path.join(kanbanUi, 'node_modules'),
      resolve: { modules: [path.join(here, 'node_modules'), 'node_modules'] },
    });
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^@\//, (resource) => {
        // A kanban-ui file's `@/` is kanban-ui's root, not this site's.
        if (resource.context.startsWith(kanbanUi)) resource.request = path.join(kanbanUi, resource.request.slice(2));
      }),
      // The demo's seam: the site's typecheck sees `screen.d.ts`, the bundle the real screen
      // (tsconfig.demo.json checks that one).
      new webpack.NormalModuleReplacementPlugin(/^@demo\/screen$/, (resource) => {
        resource.request = path.join(demo, 'Screen.tsx');
      }),
    );
    // Its server actions become the demo's stand-ins: a static site has no server to call.
    config.module.rules.push({
      test: path.join(kanbanUi, 'app', 'actions.ts'),
      enforce: 'pre',
      use: [{ loader: path.join(demo, 'stand-ins.cjs'), options: { server: path.join(demo, 'server.ts') } }],
    });
    return config;
  },
};

export default nextConfig;
