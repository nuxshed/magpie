<script lang="ts">
  import { app, bounds, duplicate, items, makecolumn, remove } from '../board.svelte'
  import { view } from '../canvas/view.svelte'

  const pad = 10
  let w = $state(0)
  let h = $state(0)
  const cards = $derived(items().filter((i) => app.sel.includes(i.id) && i.kind !== 'column').length)
  const box = $derived.by(() => {
    if (app.sel.length < 2) return null
    const b = bounds(items().filter((i) => app.sel.includes(i.id)))
    if (!b) return null
    const x = b.x * view.zoom + view.x - pad
    const y = b.y * view.zoom + view.y - pad
    return { x, y, w: b.w * view.zoom + pad * 2, h: b.h * view.zoom + pad * 2 }
  })
  const at = $derived(box && { x: Math.max(8, Math.min(box.x, innerWidth - w - 8)), y: Math.min(box.y + box.h + pad, innerHeight - h - 56) })
</script>

{#if box}
  <div class="selbox" style:left="{box.x}px" style:top="{box.y}px" style:width="{box.w}px" style:height="{box.h}px"></div>
  {#if !app.dragging && at}
    <div class="pop bar" style:left="{at.x}px" style:top="{at.y}px" bind:offsetWidth={w} bind:offsetHeight={h}>
      <span class="count">{app.sel.length} selected</span>
      {#if cards >= 2}<button class="q" type="button" onclick={() => makecolumn(app.sel)}>Make column</button>{/if}
      <button class="q" type="button" onclick={() => duplicate(app.sel)}>Duplicate</button>
      <button class="q" type="button" onclick={() => remove(app.sel)}>Delete</button>
    </div>
  {/if}
{/if}
