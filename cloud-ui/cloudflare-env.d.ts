// The bindings `wrangler.jsonc` declares, as `getCloudflareContext().env` hands them over.
// Written by hand rather than generated, because this Worker has one binding and a
// generated file would be one more build product to keep in step.

interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

declare global {
  interface CloudflareEnv {
    /** What bounds the two sign-in routes — the only ones open to a caller with no session. */
    SIGNIN_LIMITER: RateLimiter;
  }
}

export {};
