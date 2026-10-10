import { useSyncExternalStore } from "react";

const MOBILE_BREAKPOINT = 768;

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function getSnapshot() {
  return window.innerWidth < MOBILE_BREAKPOINT;
}

/**
 * Deliberately unknown for the server render and the hydration render: the real value exists only
 * in the browser, so returning `undefined` keeps the server render and the first client render
 * agreeing — the property the old `useState<boolean | undefined>(undefined)` gave this hook (lint
 * rank 8g, register row B3). `!!isMobile` coerces the unknown to `false` for callers.
 */
function getServerSnapshot(): boolean | undefined {
  return undefined;
}

export function useIsMobile() {
  const isMobile = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return !!isMobile;
}
