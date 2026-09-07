// The Markdown editor the marketing card page is built on (#434). `overtype` ships no
// types of its own, so what this page uses is declared here — the constructor, and the
// instance members the page touches. The library is a plain class, not a React component:
// `components/MarketingCardPage.tsx` mounts and destroys it in an effect.

declare module "overtype" {
  export interface OverTypeOptions {
    value?: string;
    placeholder?: string;
    fontSize?: string;
    lineHeight?: string | number;
    padding?: string;
    autoResize?: boolean;
    spellcheck?: boolean;
    /** The library's own list continuation. The page turns it off (#477): it renumbers by
     *  assigning `textarea.value`, which throws the undo stack away. */
    smartLists?: boolean;
    /** Passed straight to the textarea underneath — `readOnly` is how the page locks it
     *  while an agent is writing. */
    textareaProps?: Record<string, unknown>;
    onChange?(value: string, instance: OverTypeInstance): void;
    /** Fired after every render of the preview layer, whose HTML is rewritten wholesale
     *  each time — so the comment marks a draft carries are put back from here (#458). */
    onRender?(preview: HTMLElement, mode: string, instance: OverTypeInstance): void;
  }

  export interface OverTypeInstance {
    /** The element the library builds inside the host, and where it writes its own theme as
     *  inline custom properties. */
    container: HTMLElement;
    /** The preview layer: one element per source line, except that consecutive list lines
     *  collapse into one `<ul>`/`<ol>` and a fenced block's body into one `<pre>`. */
    preview: HTMLElement;
    /** The textarea the user actually types in. Its `selectionStart`/`selectionEnd` are
     *  offsets into the file itself, which is what a comment records with its passage. */
    textarea: HTMLTextAreaElement;
    getValue(): string;
    setValue(markdown: string): void;
    destroy(): void;
  }

  /** Built on one element and answering with the instances it made — an array, even for a
   *  single element. */
  export interface OverTypeConstructor {
    new (target: HTMLElement | string, options?: OverTypeOptions): OverTypeInstance[];
  }

  export const OverType: OverTypeConstructor;
  const _default: OverTypeConstructor;
  export default _default;
}
