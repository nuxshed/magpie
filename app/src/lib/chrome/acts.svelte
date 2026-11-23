<script lang="ts">
  import { app, discard, owner, paths, redirect, unbox } from '../board.svelte'
  import type { item } from '../model'

  let { i, add }: { i: item; add?: () => void } = $props()

  const names = $derived(Object.fromEntries(Object.entries(paths()).map(([p, id]) => [id, p])))
  const away = $derived(owner(i) !== app.current)
  const stop = (e: Event) => e.stopPropagation()
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="acts" onclick={stop}>
  {#if add}
    <button class="ib" type="button" title="Add to the canvas" aria-label="Add to the canvas" onclick={add}>
      <svg viewBox="0 0 14 14"><path d="M7 2.5v9M2.5 7h9" /></svg>
    </button>
  {/if}
  {#if away || !add}
    <button class="ib" type="button" title={away ? `Place on ${names[owner(i)]}` : 'Place on the canvas'} aria-label="Place" onclick={() => unbox(i.id)}>
      <svg viewBox="0 0 14 14"><path d="M7 1.5v7M4 5.5l3 3 3-3M2 11.5h10" /></svg>
    </button>
  {/if}
  <label class="ib" title="Move to another board's pile">
    <svg viewBox="0 0 14 14"><path d="M1.5 3.5a1 1 0 0 1 1-1h3l1.5 1.5h4.5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z" /></svg>
    <select aria-label="Move to another board's pile" onkeydown={stop} onchange={(e) => redirect(i.id, e.currentTarget.value || undefined)}>
      <option value="_" selected disabled hidden>Move</option>
      <option value="">Unsorted</option>
      {#each Object.entries(names) as [id, p] (id)}<option value={id} disabled={id === owner(i)}>{p}</option>{/each}
    </select>
  </label>
  <button class="ib" type="button" title="Remove" aria-label="Remove" onclick={() => discard(i.id)}>
    <svg viewBox="0 0 14 14"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" /></svg>
  </button>
</div>

<style>
  .acts {
    flex: none;
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .ib {
    position: relative;
    appearance: none;
    border: 0;
    margin: 0;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: none;
    color: var(--ink-2);
    display: grid;
    place-items: center;
    cursor: pointer;
    transition:
      background var(--d-fast) var(--ease),
      color var(--d-fast) var(--ease);
  }
  .ib:hover {
    background: var(--surface-2);
    color: var(--ink);
  }
  .ib:focus-visible,
  .ib:has(select:focus-visible) {
    outline: 2px solid var(--sel);
    outline-offset: 1px;
  }
  svg {
    width: 14px;
    height: 14px;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  select {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
    font-size: 16px;
  }
</style>
