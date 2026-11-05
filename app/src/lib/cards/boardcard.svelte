<script lang="ts">
  import { app } from '../board.svelte'
  import type { item } from '../model'
  import Name from './name.svelte'
  import Picture from './picture.svelte'

  let { card }: { card: item } = $props()

  const b = $derived(app.boards[card.board ?? ''])
  const live = $derived(b?.items.filter((i) => !i.deleted) ?? [])
  const cover = $derived(live.filter((i) => i.kind === 'image').slice(0, 3))
  const count = $derived(live.filter((i) => i.kind !== 'column').length)
  const trios = [
    [1, 2, 4],
    [3, 8, 12],
    [11, 7, 5],
    [6, 9, 3],
    [5, 3, 2],
    [12, 4, 8],
    [7, 1, 9]
  ]
  const tint = $derived(trios[[...(card.board ?? '')].reduce((n, ch) => n + ch.charCodeAt(0), 0) % trios.length])
</script>

<div class="cover">
  {#each tint as t, n (n)}
    <div class="ph c{t}"><Picture asset={cover[n]?.asset} /></div>
  {/each}
</div>
<div class="meta">
  {#if app.editing === card.id}
    <Name id={card.id} value={b?.name ?? ''} cls="bn" />
  {:else}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="bn" ondblclick={(e) => {
        e.stopPropagation()
        app.editing = card.id
      }}>{b?.name}</div>
  {/if}
  <div class="bc">{count} {count === 1 ? 'item' : 'items'}</div>
</div>
