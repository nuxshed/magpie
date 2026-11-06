<script lang="ts">
  import { app } from '../board.svelte'
  import { frameof, type item } from '../model'
  import Framed from './framed.svelte'

  let { card, solo, resize }: { card: item; solo: boolean; resize: (e: PointerEvent, dir: string) => void } =
    $props()

  const r = $derived(frameof(card))
  const cropping = $derived(app.cropping === card.id)
</script>

<div class="ph" style:height="{card.w / r}px">
  <Framed
    asset={card.asset}
    alt={card.caption}
    {r}
    crop={card.crop}
    edit={cropping ? (crop) => (app.live[card.id] = { crop }) : undefined}
    resizable
  />
  {#if solo && !cropping}
    {#each ['tl', 'tr', 'bl', 'brr'] as dir (dir)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <i class="h {dir}" onpointerdown={(e) => resize(e, dir)}></i>
    {/each}
  {/if}
</div>
{#if card.caption}<div class="cap">{card.caption}</div>{/if}
