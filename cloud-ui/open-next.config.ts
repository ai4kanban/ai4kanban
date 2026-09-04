import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Nothing to cache. Every page here is a signed-in read of a live board, so each one is
// rendered per request and none of them is revalidated, tagged or served from a store —
// which is why there is no incremental cache, no queue and no tag cache to configure.
export default defineCloudflareConfig({});
