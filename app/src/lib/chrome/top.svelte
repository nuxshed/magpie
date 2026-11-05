<script lang="ts">
  import { current } from '../board.svelte'
</script>

<div class="top">
  <nav class="crumbs" aria-label="Breadcrumb"><span class="here">{current()?.name}</span></nav>
</div>
