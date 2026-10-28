import { useEffect, useState } from "react";

const QUERY = "(max-width: 767px)";

/** Phone width: one column, no rail. */
export function useNarrow() {
  const [narrow, setNarrow] = useState(() => matchMedia(QUERY).matches);
  useEffect(() => {
    const m = matchMedia(QUERY);
    const on = () => setNarrow(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return narrow;
}
