<script lang="ts">
  import { app, current, href } from '../board.svelte'
  import type { board } from '../model'

  const above = $derived.by(() => {
    const list: board[] = []
    for (let b = app.boards[current()?.parent ?? '']; b; b = app.boards[b.parent ?? '']) list.unshift(b)
    return list
  })
</script>

<div class="top">
  <nav class="crumbs" aria-label="Breadcrumb">
    {#each above as b (b.id)}<a href={href(b.id)}>{b.name}</a><span class="sep">/</span>{/each}
    <span class="here">{current()?.name}</span>
  </nav>
</div>
