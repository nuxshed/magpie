<script lang="ts">
  import { addboard, addcolumn, addnote, app } from '../board.svelte'
  import { center } from '../canvas/view.svelte'
  import { room } from '../input/keys'

  let plus = $state(false)

  const kinds = [
    ['Note', () => addnote(...room('note', center()))],
    ['Column', () => addcolumn(room('column', center())[0])],
    ['Board', () => addboard(...room('board', center()))]
  ] as const
</script>

<svelte:window onpointerdown={(e) => plus && !(e.target as Element).closest('.bl') && (plus = false)} />

<div class="bl">
  <button class="q multi" class:on={app.multi} type="button" onclick={() => (app.multi = !app.multi)}>Select</button>
  {#each kinds as [label, fn] (label)}
    <button class="q wide" type="button" onclick={fn}>{label}</button>
  {/each}
  <button class="q plus" class:on={plus} type="button" aria-label="Add" onclick={() => (plus = !plus)}>
    <svg viewBox="0 0 14 14" aria-hidden="true"><path d="M7 2v10M2 7h10" /></svg>
  </button>
  {#if plus}
    <div class="pop menu adds" role="menu">
      {#each kinds as [label, fn] (label)}
        <button class="mi" type="button" onclick={() => ((plus = false), fn())}>{label}</button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .plus {
    display: none;
  }
  .adds {
    left: 0;
    bottom: calc(100% + var(--s-2));
    width: 180px;
  }
  @media (max-width: 640px) {
    .wide {
      display: none;
    }
    .plus {
      display: inline-flex;
    }
  }
</style>
