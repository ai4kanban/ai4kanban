/** An agent's own name, as a name rather than an id: `memory-pruner` → `Memory pruner`.
 *
 *  The last resort behind the copy: a role is named by `configuration.agents.roles` and a
 *  specialist by its own `AGENT.md`, and this is what an agent that says nothing gets —
 *  right in English, and never a blank. */
export function spellAgent(name: string): string {
  return name
    .split("-")
    .map((word, index) => (index === 0 ? capitalise(word) : plain(word)))
    .join(" ");
}

const plain = (word: string) => (word.toLowerCase() === "ui" ? "UI" : word);
const capitalise = (word: string) => {
  const shown = plain(word);
  return shown ? shown[0].toUpperCase() + shown.slice(1) : shown;
};
