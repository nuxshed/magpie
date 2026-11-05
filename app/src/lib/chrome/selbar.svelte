<script lang="ts">
  import { app, bounds, duplicate, items, remove } from '../board.svelte'
  import { view } from '../canvas/view.svelte'

  const pad = 10
  const box = $derived.by(() => {
    if (app.sel.length < 2) return null
    const b = bounds(items().filter((i) => app.sel.includes(i.id)))
    if (!b) return null
    const x = b.x * view.zoom + view.x - pad
    const y = b.y * view.zoom + view.y - pad
    return { x, y, w: b.w * view.zoom + pad * 2, h: b.h * view.zoom + pad * 2 }
  })
</script>

{#if box}
  <div class="selbox" style:left="{box.x}px" style:top="{box.y}px" style:width="{box.w}px" style:height="{box.h}px"></div>
  {#if !app.dragging}
    <div class="pop bar" style:left="{box.x}px" style:top="{box.y + box.h + pad}px">
      <span class="count">{app.sel.length} selected</span>
      <button class="q" type="button" onclick={() => duplicate(app.sel)}>Duplicate</button>
      <button class="q" type="button" onclick={() => remove(app.sel)}>Delete</button>
    </div>
  {/if}
{/if}
