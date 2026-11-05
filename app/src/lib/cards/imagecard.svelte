<script lang="ts">
  import type { item } from '../model'
  import { loadasset } from '../store/images'

  let { card, solo, resize }: { card: item; solo: boolean; resize: (e: PointerEvent, dir: string) => void } =
    $props()

  const asset = $derived(card.asset)
  let src = $state<string>()

  $effect(() => {
    let url = ''
    let gone = false
    if (asset)
      loadasset(asset).then((b) => {
        if (b && !gone) src = url = URL.createObjectURL(b)
      })
    return () => {
      gone = true
      if (url) URL.revokeObjectURL(url)
    }
  })
</script>

<div class="ph" style:height="{card.w / (card.aspect ?? 1)}px">
  {#if src}<img {src} alt={card.caption ?? ''} draggable="false" />{/if}
  {#if solo}
    {#each ['tl', 'tr', 'bl', 'brr'] as dir (dir)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <i class="h {dir}" onpointerdown={(e) => resize(e, dir)}></i>
    {/each}
  {/if}
</div>
{#if card.caption}<div class="cap">{card.caption}</div>{/if}
