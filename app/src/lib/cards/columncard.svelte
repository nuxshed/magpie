<script lang="ts">
  import { app, gap, kids, lifted, pad, update } from '../board.svelte'
  import type { item } from '../model'
  import Card from './card.svelte'
  import Name from './name.svelte'

  let { card }: { card: item } = $props()

  const all = $derived(kids(card.id))
  const list = $derived(all.filter((k) => !lifted(k.id)))
  const t = $derived(app.target?.col === card.id && !card.collapsed ? app.target : null)
  const open = $derived(t?.h ? t.h + gap : 0)
  const line = $derived.by(() => {
    if (!t) return 0
    let y = 0
    for (const k of list.slice(0, t.slot)) y += (app.heights[k.id] ?? 0) + gap
    return y - 4
  })
</script>

<div class="col-h">
  <button
    type="button"
    aria-label={card.collapsed ? 'Expand column' : 'Collapse column'}
    onpointerdown={(e) => e.stopPropagation()}
    onclick={() => update({ [card.id]: { collapsed: !card.collapsed } })}
  >
    <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" /></svg>
  </button>
  {#if app.editing === card.id}
    <Name id={card.id} value={card.name ?? ''} cls="col-t" />
  {:else}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <span class="col-t" ondblclick={() => (app.editing = card.id)}>{card.name}</span>
  {/if}
  <span class="col-n">{all.length}</span>
</div>
{#if !card.collapsed}
  <div class="stack" style:padding-bottom="{open}px">
    {#each list as k, i (k.id)}
      <Card card={k} colw={card.w - pad * 2} shift={t && i >= t.slot ? open : 0} />
    {/each}
    {#if t}<div class="drop" style:top="{line}px"></div>{/if}
  </div>
{/if}
