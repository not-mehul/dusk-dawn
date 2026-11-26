// Marks a sticky bar (style.md §8.5, `.tab-bar-sticky`) while it is stuck
// at the top of the screen, as `.is-stuck`, so its strip and the cover over
// the status bar appear only then. At rest, under the page header, the bar
// is just the tabs on the page: no box, no empty space for the status bar.

/**
 * Svelte action: `<nav class="tab-bar-sticky" use:markStuck>`.
 * @param {HTMLElement} node
 */
export function markStuck(node) {
  let observer;
  const watch = () => {
    observer?.disconnect();
    // Stuck means its top edge has reached its sticky `top` (the status bar's
    // height): watch the line one pixel below that.
    const top = parseFloat(getComputedStyle(node).top) || 0;
    observer = new IntersectionObserver(
      ([entry]) => node.classList.toggle('is-stuck', entry.intersectionRatio < 1 && entry.boundingClientRect.top <= top + 1),
      { rootMargin: `${-Math.ceil(top + 1)}px 0px 0px 0px`, threshold: [1] }
    );
    observer.observe(node);
  };
  watch();
  // The status bar's height can change (rotation, a cut-out): measure again.
  window.addEventListener('resize', watch);
  return {
    destroy() {
      observer?.disconnect();
      window.removeEventListener('resize', watch);
      node.classList.remove('is-stuck');
    }
  };
}
