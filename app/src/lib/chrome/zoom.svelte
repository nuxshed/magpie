<script lang="ts">
  import { app } from '../board.svelte'
  import { reset, step, view } from '../canvas/view.svelte'
  import Inbox from './inbox.svelte'
</script>

<div class="br">
  <Inbox />
  {#if !app.flat}
    <button class="q" type="button" aria-label="Zoom out" onclick={() => step(-1)}>−</button>
    <button class="q" type="button" onclick={reset}>{Math.round(view.zoom * 100)}%</button>
    <button class="q" type="button" aria-label="Zoom in" onclick={() => step(1)}>+</button>
  {/if}
</div>
