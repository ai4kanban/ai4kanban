// A recipe ships the code it was verified with, and the bundler inlines that code as text
// (`loader` in scripts/build.mjs) so `akb` carries it to read out, never to run. Together
// with the `exclude` in tsconfig.json this is what tells TypeScript a `.tsx` import is a
// string and keeps it from compiling the recipe as source.

declare module '*.tsx' {
  const text: string
  export default text
}
