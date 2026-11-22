/** Holds a toast lift (px) until released; call `set` again as the holder resizes. */
export function holdToastLift(): { set: (px: number) => void; release: () => void };
/**
 * Lifts the toast above `el` while it sits at the bottom of the screen. Returns
 * the release function; also usable as a Svelte action (`use:liftToastAbove`).
 */
export function liftToastAbove(el: HTMLElement, gap?: number): (() => void) & { destroy: () => void };
