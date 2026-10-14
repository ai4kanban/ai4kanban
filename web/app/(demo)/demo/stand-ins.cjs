// kanban-ui/app/actions.ts as /demo builds it (next.config.mjs): the same exports, none of
// them a server action — each one asks ./server.ts, which answers the few the screens read.
module.exports = function standIns(source) {
  const server = JSON.stringify(this.getOptions().server);
  const names = [...source.matchAll(/^export async function (\w+)/gm)].map((m) => m[1]);
  return [
    `import { answer } from ${server};`,
    ...names.map((name) => `export const ${name} = (...args) => answer(${JSON.stringify(name)}, args);`),
  ].join("\n");
};
