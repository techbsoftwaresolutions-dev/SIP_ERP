import { useEffect, useState } from "react";

// Returns `value` only after it has stopped changing for `delay` ms — so a
// search box fires one request when typing pauses, not one per keystroke.
export default function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
