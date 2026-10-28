// Stands in for next/link and next/navigation: the address is the state, pushed with history.

import { useEffect, useState, type AnchorHTMLAttributes } from "react";

const listeners = new Set<() => void>();
const tell = () => listeners.forEach((fn) => fn());
window.addEventListener("popstate", tell);

export function navigate(to: string, replace = false) {
  if (to === location.pathname + location.search) return;
  if (replace) history.replaceState(null, "", to);
  else history.pushState(null, "", to);
  window.scrollTo(0, 0);
  tell();
}

export function useLocation() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick((n) => n + 1);
    listeners.add(fn);
    return () => void listeners.delete(fn);
  }, []);
  return { path: location.pathname, query: new URLSearchParams(location.search) };
}

export function Link({ href, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <a
      href={href}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || rest.target) return;
        e.preventDefault();
        navigate(href);
      }}
      {...rest}
    />
  );
}
