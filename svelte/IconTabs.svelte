<script lang="ts" generics="V extends string">
  // style.md §8.5.1. The tab rail with an icon over each word, the tabs
  // sharing the width evenly so none is pushed off the edge, even with the
  // phone's text size turned up. Same keyboard, ARIA and rule as TabRail.
  // The app passes each icon as a snippet, drawn in its own Lucide set.
  import { tick, type Snippet } from 'svelte';

  interface Tab {
    id: V;
    label: string;
    /** The tab's icon, about 22px, stroked in currentColor. */
    icon: Snippet;
    /** A count on the icon's corner. */
    badge?: number;
    /** The tab button's DOM id, for tests and aria-labelledby. */
    domId?: string;
    /** The panel the tab controls. */
    controls?: string;
  }

  interface Props {
    tabs: readonly Tab[];
    value: V;
    label: string;
    onselect: (id: V) => void;
  }

  let { tabs, value, label, onselect }: Props = $props();
  let rail: HTMLDivElement;
  const hasValue = $derived(tabs.some((t) => t.id === value));
  let ruleX = $state(0);
  let ruleWidth = $state(0);

  function place() {
    const active = rail?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!active) {
      ruleWidth = 0;
      return;
    }
    // A short rule centred under the icon, not the whole share of the width.
    const width = Math.min(active.offsetWidth, 56);
    ruleX = active.offsetLeft + (active.offsetWidth - width) / 2;
    ruleWidth = width;
  }

  $effect(() => {
    void value;
    void tabs;
    void tick().then(place);
  });

  $effect(() => {
    const observer = new ResizeObserver(() => place());
    observer.observe(rail);
    return () => observer.disconnect();
  });

  function onkeydown(event: KeyboardEvent) {
    const i = Math.max(
      0,
      tabs.findIndex((t) => t.id === value)
    );
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const tab = tabs[(i + step + tabs.length) % tabs.length];
    if (!tab) return;
    onselect(tab.id);
    void tick().then(() => rail.querySelector<HTMLElement>('[aria-selected="true"]')?.focus());
  }
</script>

<div
  class="icon-tabs"
  role="tablist"
  aria-label={label}
  tabindex="-1"
  bind:this={rail}
  style:--rule-x="{ruleX}px"
  style:--rule-width="{ruleWidth}px"
  style:--rule-opacity={hasValue ? 1 : 0}
  {onkeydown}
>
  {#each tabs as tab, i (tab.id)}
    <button
      type="button"
      role="tab"
      id={tab.domId}
      aria-controls={tab.controls}
      aria-selected={tab.id === value}
      tabindex={tab.id === value || (!hasValue && i === 0) ? 0 : -1}
      onclick={() => onselect(tab.id)}
    >
      <span class="icon-tab-glyph">
        {@render tab.icon()}
        {#if tab.badge}<span class="badge">{tab.badge > 99 ? '99+' : tab.badge}</span>{/if}
      </span>
      <span class="icon-tab-word">{tab.label}</span>
    </button>
  {/each}
  <span class="tab-rule" aria-hidden="true"></span>
</div>
