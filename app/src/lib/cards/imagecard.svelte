<script lang="ts">
  import type { item } from '../model'
  import Picture from './picture.svelte'

  let { card, solo, resize }: { card: item; solo: boolean; resize: (e: PointerEvent, dir: string) => void } =
    $props()
</script>

<div class="ph" style:height="{card.w / (card.aspect ?? 1)}px">
  <Picture asset={card.asset} alt={card.caption} />
  {#if solo}
    {#each ['tl', 'tr', 'bl', 'brr'] as dir (dir)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <i class="h {dir}" onpointerdown={(e) => resize(e, dir)}></i>
    {/each}
  {/if}
</div>
{#if card.caption}<div class="cap">{card.caption}</div>{/if}
