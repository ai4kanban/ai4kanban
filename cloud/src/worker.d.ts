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

declare interface R2ObjectBody {
  readonly size: number
  readonly httpMetadata?: { contentType?: string }
  readonly body: ReadableStream
  arrayBuffer(): Promise<ArrayBuffer>
}

/** The parts of an R2 binding the template catalog uses (#1708). */
declare interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>
  put(
    key: string,
    value: ArrayBuffer | Uint8Array | string,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>
  delete(keys: string | string[]): Promise<void>
  list(options?: { prefix?: string; cursor?: string }): Promise<{
    objects: { key: string }[]
    truncated: boolean
    cursor?: string
  }>
}
