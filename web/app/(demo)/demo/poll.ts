// kanban-ui/lib/poll.ts as /demo builds it (next.config.mjs): no fetch, ./server.ts answers.
import { answerPoll } from "./server";

export async function poll<T>(path: string): Promise<T> {
  return answerPoll(path) as Promise<T>;
}
