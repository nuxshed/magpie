<script lang="ts">
  import { addnote } from '../board.svelte'
  import { center } from '../canvas/view.svelte'
</script>

<div class="bl"><button class="q" type="button" onclick={() => addnote(center())}>Note</button></div>
