// A stylesheet imported `with { type: 'text' }` is its text (scripts/build.mjs).
declare module '*.css' {
  const text: string
  export default text
}

declare module '*.html' { const text: string; export default text }
declare module '*.txt' { const text: string; export default text }
// The bundled settings page (scripts/settings-client.mjs).
declare module 'virtual:settings-client' { const text: string; export default text }
