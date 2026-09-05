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
};

export default nextConfig;
