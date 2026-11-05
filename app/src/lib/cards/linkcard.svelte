<script lang="ts">
  import type { item } from '../model'
  import Picture from './picture.svelte'

  let { card }: { card: item } = $props()

  const short = $derived(card.url?.replace(/^https?:\/\/(www\.)?/, '') ?? '')
  const name = $derived(card.title ?? short)
  const site = $derived(card.site ?? short.split('/')[0])
  const compact = $derived(card.layout === 'compact')
</script>

{#if !card.fetched}
  <div class={compact ? 'ph sk' : 'sk blk'}></div>
  <div class="body">
    <div class="url">{short}</div>
    {#if !compact}
      <div class="sk" style:width="80%" style:margin-top="10px"></div>
      <div class="sk" style:width="55%" style:margin-top="6px"></div>
    {/if}
  </div>
{:else}
  {#if card.thumb || compact}
    <div class="ph"><Picture asset={card.thumb} alt={name} /></div>
  {:else}
    <div class="fallback">{name}</div>
  {/if}
  <div class="body">
    {#if card.thumb || compact}<div class="ttl">{name}</div>{/if}
    {#if card.desc && !compact}<div class="desc">{card.desc}</div>{/if}
    <div class="site"><span class="fav">{site[0]?.toUpperCase()}</span>{site}</div>
  </div>
{/if}
{#if card.note && !compact}<div class="unote">{card.note}</div>{/if}
