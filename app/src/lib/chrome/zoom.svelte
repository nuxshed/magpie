<script lang="ts">
  import { reset, step, view } from '../canvas/view.svelte'
</script>

<div class="br">
  <button class="q" type="button" aria-label="Zoom out" onclick={() => step(-1)}>−</button>
  <button class="q" type="button" onclick={reset}>{Math.round(view.zoom * 100)}%</button>
  <button class="q" type="button" aria-label="Zoom in" onclick={() => step(1)}>+</button>
</div>
