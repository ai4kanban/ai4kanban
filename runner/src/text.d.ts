// A stylesheet imported `with { type: 'text' }` is its text (scripts/build.mjs).
declare module '*.css' {
  const text: string
  export default text
}
