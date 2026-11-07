// What the launcher and the Runner agree on.

declare const __RUNNER_VERSION__: string | undefined
declare const __AKB_VERSION__: string | undefined
declare const __AKB_CONTRACT__: number | undefined

/** This build's version, stamped in by scripts/build.mjs. */
export const VERSION = typeof __RUNNER_VERSION__ === 'string' ? __RUNNER_VERSION__ : '0.0.0'

/** The akb this build carries, and the contract an akb must keep to run under it (#171). */
export const AKB_VERSION = typeof __AKB_VERSION__ === 'string' ? __AKB_VERSION__ : '0.0.0'
export const AKB_CONTRACT = typeof __AKB_CONTRACT__ === 'number' ? __AKB_CONTRACT__ : 0

/** Cloud said no for good — another computer, an account not admitted, a failed sign-in.
 *  Not a crash: the launcher keeps this version. */
export const EXIT_REFUSED = 10
/** Cloud no longer takes this protocol. A restart updates. */
export const EXIT_OUTDATED = 11

/** 已保存更新进度，启动器可以换版。 */
export const EXIT_UPDATE = 12
