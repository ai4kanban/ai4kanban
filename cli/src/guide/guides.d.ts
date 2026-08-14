// The flows ship as markdown, and the bundler inlines them as text (`loader: {'.md':
// 'text'}` in scripts/build.mjs). This is what tells TypeScript that an `.md` import is a
// string — nothing here is read at runtime.

declare module '*.md' {
  const text: string
  export default text
}
