<script lang="ts">
  import { addboard, addcolumn, addnote } from '../board.svelte'
  import { center } from '../canvas/view.svelte'
  import { room } from '../input/keys'
</script>

<div class="bl">
  <button class="q" type="button" onclick={() => addnote(...room('note', center()))}>Note</button>
  <button class="q" type="button" onclick={() => addcolumn(room('column', center())[0])}>Column</button>
  <button class="q" type="button" onclick={() => addboard(...room('board', center()))}>Board</button>
</div>
