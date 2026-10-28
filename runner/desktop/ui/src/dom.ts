// A few lines of DOM building: each window redraws itself whole when its state changes.

type Child = Node | string | number | null | undefined | false
type Props = Record<string, unknown> & { class?: string; style?: string }

export function h(tag: string, props: Props = {}, ...children: (Child | Child[])[]): HTMLElement {
  const el = document.createElement(tag)
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue
    if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value as EventListener)
    else if (key === 'html') el.innerHTML = String(value)
    else el.setAttribute(key, value === true ? '' : String(value))
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue
    el.append(typeof child === 'object' ? child : String(child))
  }
  return el
}

/** Swap a root's content, keeping the scroll of every element marked `data-keep`. */
export function draw(root: HTMLElement, next: HTMLElement): void {
  const kept = new Map<string, number>()
  for (const el of root.querySelectorAll<HTMLElement>('[data-keep]')) kept.set(el.dataset.keep!, el.scrollTop)
  root.replaceChildren(next)
  for (const el of root.querySelectorAll<HTMLElement>('[data-keep]')) el.scrollTop = kept.get(el.dataset.keep!) ?? 0
}

export const CRANE =
  '<svg viewBox="0 0 60 60" aria-hidden="true"><path fill="currentColor" d="M2 55.75C2 55.69 2.69 55.09 3.55 54.37L5.09 53.1L6.61 53.1L8.13 53.1L12.49 49.87C14.9 48.07 16.83 46.58 16.77 46.53C16.75 46.47 15.56 46.64 14.15 46.89C12.74 47.13 11.55 47.3 11.53 47.24C11.47 47.19 12.02 46.22 12.71 45.06L14.01 42.96L18.21 41.34C20.53 40.45 22.41 39.65 22.41 39.57C22.41 39.49 21.27 38.55 19.92 37.5C15.92 34.4 13.13 31.31 10.86 27.47L10.01 26.01L10.53 26.18C10.84 26.26 12.96 27.2 15.28 28.25C17.6 29.32 19.53 30.12 19.59 30.07C19.64 30.01 17.68 28.69 15.25 27.11C12.8 25.57 10.56 23.97 10.31 23.58C9.15 21.95 7.25 17.5 7.25 16.46C7.25 16.26 10.01 17.95 13.38 20.18C16.77 22.45 19.73 24.38 19.95 24.49C20.42 24.74 20.25 24.57 13.9 19.02L9.18 14.88L8.6 13.36C7.72 10.96 6.97 7.54 6.97 5.77L6.97 4.14L9.4 6.46C12.66 9.61 15.56 12.01 23.57 18.25C27.32 21.18 30.5 23.72 30.64 23.91C30.8 24.08 31.68 26.51 32.6 29.3L34.28 34.35L35.72 35.65C37.54 37.3 37.98 37.47 36.85 36.09L35.96 35.01L37.12 34.71C39.11 34.21 40.16 33.52 42.54 31.12L44.8 28.8L46.02 28.96C46.71 29.07 47.56 29.07 47.95 28.96L48.67 28.8L48.67 28.25L48.67 27.69L49.27 27.69C49.63 27.69 50.1 27.58 50.32 27.42L50.71 27.17L51.01 27.42C51.18 27.56 52.78 27.86 54.58 28.08C56.37 28.3 57.86 28.52 57.94 28.58C58 28.63 56.73 28.85 55.13 29.05C53.53 29.24 50.96 29.77 49.44 30.21C47.92 30.65 46.57 31.01 46.43 31.01C46.29 31.01 44.22 32.97 41.85 35.37C37.57 39.62 34.42 42.14 30.83 44.15L29.14 45.09L25.97 45.73L22.77 46.39L14.59 51.11L6.42 55.86L4.21 55.86C2.99 55.86 2 55.8 2 55.75Z"/><path fill="#dd4f1e" d="M44.97 27.45C44.61 26.89 46.57 25.76 47.87 25.76C48.72 25.76 50.6 26.7 50.6 27.14C50.6 27.64 45.27 27.97 44.97 27.45Z"/></svg>'

export const icon = (html: string, cls = 'icon') => h('span', { class: cls, html })

export const ICONS = {
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M15 6l-6 6 6 6"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>',
  folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M18 8a6 6 0 0 0-12 0v5l-2 3h16l-2-3zM13.7 20a2 2 0 0 1-3.4 0"/></svg>',
  bellOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M18 8a6 6 0 0 0-9.3-5M6 8v5l-2 3h13M13.7 20a2 2 0 0 1-3.4 0M3 3l18 18"/></svg>',
}
