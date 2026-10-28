// What the launcher and the Runner agree on.

declare const __RUNNER_VERSION__: string | undefined

/** This build's version, stamped in by scripts/build.mjs. */
export const VERSION = typeof __RUNNER_VERSION__ === 'string' ? __RUNNER_VERSION__ : '0.0.0'

/** Cloud said no for good — another computer, an account not admitted, a failed sign-in.
 *  Not a crash: the launcher keeps this version. */
export const EXIT_REFUSED = 10
/** Cloud no longer takes this protocol. A restart updates. */
export const EXIT_OUTDATED = 11
