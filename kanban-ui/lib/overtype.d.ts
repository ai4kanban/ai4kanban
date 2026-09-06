// The Markdown editor the marketing card page is built on (#434). `overtype` ships no
// types of its own, so what this page uses is declared here — the constructor, and the four
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
    /** Passed straight to the textarea underneath — `readOnly` is how the page locks it
     *  while an agent is writing. */
    textareaProps?: Record<string, unknown>;
    onChange?(value: string, instance: OverTypeInstance): void;
  }

  export interface OverTypeInstance {
    /** The textarea the user actually types in. Its `selectionStart`/`selectionEnd` are
     *  offsets into the file itself, which is what "改这段" sends with the selected text. */
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
