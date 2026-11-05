<script lang="ts">
  import { app, cover, items, pictures, setcover } from '../board.svelte'
  import Picture from '../cards/picture.svelte'

  const b = $derived(app.boards[app.covering ?? ''])
  const all = $derived(b ? pictures(b.id) : [])
  const pinned = $derived(b?.cover ?? [])
  const shown = $derived(b ? cover(b.id) : [])
  const w = 400
  let h = $state(0)

  /** beside the board card, on whichever side has room */
  const pos = $derived.by(() => {
    const id = items().find((i) => i.board === b?.id)?.id
    const r = document.querySelector(`[data-id="${id}"]`)?.getBoundingClientRect()
    if (!r) return { x: (innerWidth - w) / 2, y: (innerHeight - h) / 2 }
    const x = r.right + 12 + w < innerWidth ? r.right + 12 : Math.max(16, r.left - 12 - w)
    return { x, y: Math.max(16, Math.min(r.top, innerHeight - h - 16)) }
  })

  /** pin a picture, or unpin it, three at most */
  function toggle(a: string) {
    setcover(b.id, pinned.includes(a) ? pinned.filter((x) => x !== a) : [...pinned, a].slice(-3))
  }
</script>

{#if b}
  <div class="shade" role="presentation" onpointerdown={() => (app.covering = null)}></div>
  <div
    class="pop covers"
    role="dialog"
    aria-label="Choose cover"
    style:left="{pos.x}px"
    style:top="{pos.y}px"
    style:width="{w}px"
    bind:offsetHeight={h}
  >
    <div class="rl">Cover for {b.name}</div>
    <div class="grid">
      {#each all as a (a)}
        <button class="tile" class:on={shown.includes(a)} type="button" onclick={() => toggle(a)}>
          <div class="ph"><Picture asset={a} /></div>
          {#if pinned.includes(a)}<span class="n">{pinned.indexOf(a) + 1}</span>{/if}
        </button>
      {:else}
        <div class="none">No pictures in this board yet</div>
      {/each}
    </div>
    <div class="foot">
      <span class="hint">Pick up to three. The first is the big one.</span>
      <span>
        {#if pinned.length}<button class="q" type="button" onclick={() => setcover(b.id)}>Automatic</button>{/if}
        <button class="q" type="button" onclick={() => (app.covering = null)}>Done</button>
      </span>
    </div>
  </div>
{/if}
