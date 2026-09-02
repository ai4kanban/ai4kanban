// 220 words a minute, the middle of the range for adult reading on a screen,
// and never less than a minute — "0 min read" reads as a bug, not as brevity.
const WORDS_PER_MINUTE = 220;

/** How long a long-form body takes to read, in whole minutes. */
export function countReadMinutes(body: string): number {
  const words = body
    .replace(/```[\s\S]*?```/g, " ") // a code block is not read word by word
    .replace(/<[^>]+>/g, " ") // JSX/HTML tags
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
