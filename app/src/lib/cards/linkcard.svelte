<script lang="ts">
  import type { item } from '../model'

  let { card }: { card: item } = $props()
</script>

<div class="body">
  <div class="url">{card.url?.replace(/^https?:\/\/(www\.)?/, '')}</div>
</div>
{#if card.note}<div class="unote">{card.note}</div>{/if}
