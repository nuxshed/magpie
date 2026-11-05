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
</script>

{#if cover.length}
  <div class="cover">
    {#each [0, 1, 2] as n (n)}
      <div class="ph"><Picture asset={cover[n]?.asset} /></div>
    {/each}
  </div>
{:else}
  <div class="cover empty"></div>
{/if}
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
