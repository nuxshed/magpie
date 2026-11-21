<script lang="ts">
  import { tick } from 'svelte'
  import { app, flatorder, items, kids } from '../board.svelte'
  import Card from '../cards/card.svelte'

  const gap = 16
  let w = $state(0)
  let newest = $state(false)
  let el = $state<HTMLDivElement>()
  const n = $derived(Math.max(1, Math.floor((w + gap) / (300 + gap))))
  const colw = $derived(Math.floor((w - gap * (n - 1)) / n))
  const list = $derived(
    newest
      ? items()
          .filter((i) => i.kind !== 'column')
          .sort((a, b) => (b.added ?? b.updated) - (a.added ?? a.updated))
      : flatorder()
  )

  $effect(() => {
    app.current
    if (el) el.scrollTop = 0
  })

  $effect(() => {
    const id = app.last
    if (id) tick().then(() => el?.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ block: 'nearest' }))
  })
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="flat" bind:this={el} onpointerdown={(e) => !(e.target as Element).closest('[data-id]') && (app.sel = [])}>
  <div class="order">
    <button class="q" class:on={!newest} type="button" onclick={() => (newest = false)}>Board order</button>
    <button class="q" class:on={newest} type="button" onclick={() => (newest = true)}>Newest</button>
  </div>
  <div class="cols" bind:clientWidth={w} style:column-count={n} style:column-gap="{gap}px">
    {#each list as i (i.id)}
      {#if i.kind === 'column'}
        <div class="sec">
          <div class="sh"><span>{i.name}</span><span class="col-n">{kids(i.id).length}</span></div>
          {#each kids(i.id) as k (k.id)}<Card card={k} {colw} flat />{/each}
        </div>
      {:else}
        <Card card={i} {colw} flat />
      {/if}
    {/each}
  </div>
  {#if !list.length}
    <div class="none">Nothing on this board yet.</div>
  {/if}
</div>

<style>
  .flat {
    position: absolute;
    inset: 0;
    overflow: auto;
    touch-action: pan-y;
    padding: 64px 24px 72px;
  }
  .order {
    display: flex;
    gap: 2px;
    margin: 0 0 12px -8px;
  }
  .cols :global(.card) {
    position: relative;
    margin-bottom: var(--s-6);
    break-inside: avoid;
    transition: none;
  }
  .cols :global(.board) {
    width: auto;
  }
  .sh {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 13px;
    font-weight: 500;
    color: var(--ink-2);
    padding: 4px 2px 8px;
    break-after: avoid;
  }
  :global(.app:has(.flat) :is(.top, .bl, .br)) {
    background: var(--canvas);
  }
  :global(.app:has(.flat) :is(.bl, .br)) {
    border-radius: var(--r-m);
    padding: 2px;
  }
  .none {
    color: var(--ink-3);
    font-size: 13px;
    padding: 24px 0;
  }
  @media (max-width: 600px) {
    .flat {
      padding: 64px 16px 72px;
    }
    .cols :global(.card) {
      margin-bottom: var(--s-7);
    }
    .sh {
      padding-top: var(--s-5);
    }
  }
</style>
