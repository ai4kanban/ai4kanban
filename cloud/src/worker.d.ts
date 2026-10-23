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
  /** Set when the read asked for a range (#1711). */
  readonly range?: { offset?: number; length?: number; suffix?: number }
  arrayBuffer(): Promise<ArrayBuffer>
}

/** The parts of an R2 binding the template catalog uses (#1708). */
declare interface R2Bucket {
  get(key: string, options?: { range?: Headers }): Promise<R2ObjectBody | null>
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

/** The parts of a Durable Object namespace and its state that hosted music uses (#1828). */
declare interface DurableObjectNamespace {
  newUniqueId(): unknown
  idFromName(name: string): unknown
  get(id: unknown): { fetch(input: string, init?: RequestInit): Promise<Response> }
}

declare interface DurableObjectState {
  readonly storage: { setAlarm(at: number): Promise<void> }
}
