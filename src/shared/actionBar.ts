import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

// Helpers for screens with a fixed answer bar at the bottom (thumb zone).

/** Height of the fixed bar, so the page can reserve the same space below its content. */
export function useElementHeight(ref: RefObject<HTMLElement | null>): number {
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setHeight(el.getBoundingClientRect().height);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return height;
}

/**
 * Answer buttons and "Dalej" share the same spot, so a double tap could answer the next task
 * or skip the explanation. After every switch the bar ignores taps for a moment.
 */
export function useTapGuard(ms = 350): { arm: () => void; ready: () => boolean } {
  const until = useRef(0);
  const arm = useCallback(() => {
    until.current = performance.now() + ms;
  }, [ms]);
  const ready = useCallback(() => performance.now() >= until.current, []);
  return { arm, ready };
}

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Scrolls just enough to show the top of `el` (up to `want` px of it) above the fixed bar. */
export function revealAboveBar(el: HTMLElement, bar: HTMLElement | null, want = 240): void {
  const rect = el.getBoundingClientRect();
  const visibleBottom = window.innerHeight - (bar?.getBoundingClientRect().height ?? 0);
  const margin = 16;
  const needed = rect.top + Math.min(rect.height, want) + margin - visibleBottom;
  const maxScroll = rect.top - margin; // never push the start of `el` off the top
  const by = Math.min(needed, maxScroll);
  if (by > 0) window.scrollBy({ top: by, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}
