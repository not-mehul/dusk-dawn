// Keeps the toast (style.md §8.12) clear of whatever is docked at the
// bottom of the screen: a sheet, an action bar, a tray. Each holder asks
// for a lift in pixels; the toast rises by the largest, through
// --toast-lift on <body>, so two holders never undo each other.

/** @type {Map<symbol, number>} */
const lifts = new Map();

function apply() {
  const highest = Math.max(0, ...lifts.values());
  const style = document.body.style;
  if (highest) style.setProperty('--toast-lift', `${Math.round(highest)}px`);
  else style.removeProperty('--toast-lift');
}

/**
 * Holds a lift until released. Call `set` again whenever the holder resizes.
 * @returns {{ set: (px: number) => void, release: () => void }}
 */
export function holdToastLift() {
  const key = Symbol('toast-lift');
  return {
    set(px) {
      lifts.set(key, px);
      apply();
    },
    release() {
      lifts.delete(key);
      apply();
    },
  };
}

/**
 * Lifts the toast above `el` whenever `el` sits at (or floats just above)
 * the bottom of the screen, until the returned function is called. Works as a
 * Svelte action too: `use:liftToastAbove`.
 * @param {HTMLElement} el
 * @param {number} [gap] space left between the two, in px
 * @returns {(() => void) & { destroy: () => void }}
 */
export function liftToastAbove(el, gap = 12) {
  const lift = holdToastLift();
  const measure = () => {
    const rect = el.getBoundingClientRect();
    const docked = rect.height > 0 && rect.bottom >= innerHeight - 40;
    // Never so high that the toast would leave the screen.
    lift.set(docked ? Math.min(innerHeight - rect.top + gap, innerHeight - 120) : 0);
  };
  const observer = new ResizeObserver(measure);
  observer.observe(el);
  // Size, the viewport, scrolling (a sticky bar docks and undocks) and the end
  // of an entrance animation all move it.
  addEventListener('resize', measure);
  addEventListener('scroll', measure, { passive: true });
  el.addEventListener('animationend', measure);
  el.addEventListener('transitionend', measure);
  measure();
  const release = () => {
    observer.disconnect();
    removeEventListener('resize', measure);
    removeEventListener('scroll', measure);
    el.removeEventListener('animationend', measure);
    el.removeEventListener('transitionend', measure);
    lift.release();
  };
  return Object.assign(release, { destroy: release });
}
