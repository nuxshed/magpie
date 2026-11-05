<script lang="ts">
  import { addboard, addcolumn, addnote } from '../board.svelte'
  import { center } from '../canvas/view.svelte'
</script>

<div class="bl">
  <button class="q" type="button" onclick={() => addnote(center())}>Note</button>
  <button class="q" type="button" onclick={() => addcolumn(center())}>Column</button>
  <button class="q" type="button" onclick={() => addboard(center())}>Board</button>
</div>
