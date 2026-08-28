// The Workers runtime types this service uses. Declared here so a checkout typechecks with
// TypeScript alone; everything else comes from the `WebWorker` lib.

declare interface ScheduledController {
  readonly scheduledTime: number
  readonly cron: string
  noRetry(): void
}

declare interface ExecutionContext {
  /** Keep the isolate alive for work the response does not wait on — the invitation mail. */
  waitUntil(promise: Promise<unknown>): void
  passThroughOnException(): void
}
