<script lang="ts">
  import { alive, app, duplicate, items, openboard, remove, sendto, update } from '../board.svelte'
  import type { item } from '../model'

  let h = $state(0)
  const sel = $derived(items().filter((i) => app.sel.includes(i.id)))
  const one = $derived(sel.length === 1 ? sel[0] : undefined)
  const pos = $derived(app.menu && { x: Math.min(app.menu.x, innerWidth - 240), y: Math.min(app.menu.y, innerHeight - h - 8) })

  /** a board's names from home down */
  function path(id: string) {
    const names: string[] = []
    for (let b = app.boards[id]; b; b = app.boards[b.parent ?? '']) names.unshift(b.name)
    return names
  }

  /** boards the selection can move to: not this one, and not inside a board being moved */
  const dests = $derived.by(() => {
    const moving = new Set(sel.map((i) => i.board).filter(Boolean))
    const inside = (id: string) => [...moving].some((m) => m && isunder(id, m))
    return Object.values(app.boards)
      .filter((b) => b.id !== app.current && alive(b.id) && !inside(b.id))
      .map((b) => ({ id: b.id, names: path(b.id) }))
      .sort((a, b) => a.names.join('/').localeCompare(b.names.join('/')))
  })

  function isunder(id: string, top: string) {
    for (let b = app.boards[id]; b; b = app.boards[b.parent ?? '']) if (b.id === top) return true
    return false
  }

  function run(fn: () => void) {
    app.menu = null
    fn()
  }

  const moving = () => sel.filter((i) => !app.sel.includes(i.parent ?? ''))
  const edit = (i: item) => (app.editing = i.id)
</script>

{#if app.menu && pos && sel.length}
  <div
    class="pop menu"
    role="menu"
    tabindex="-1"
    style:left="{pos.x}px"
    style:top="{pos.y}px"
    bind:offsetHeight={h}
    onpointerdown={(e) => e.stopPropagation()}
  >
    {#if app.menu.pick}
      <div class="rl">Move to board</div>
      {#each dests as d (d.id)}
        <button class="mi" type="button" onclick={() => run(() => sendto(moving(), d.id))}>
          {d.names.at(-1)}<span class="s">{d.names.slice(0, -1).join(' / ')}</span>
        </button>
      {:else}
        <div class="mi s">No other boards</div>
      {/each}
    {:else}
      {#if one?.kind === 'link'}
        <button class="mi" type="button" onclick={() => run(() => window.open(one.url, '_blank', 'noopener'))}>
          Open link<span class="s">↵</span>
        </button>
      {:else if one?.kind === 'board'}
        <button class="mi" type="button" onclick={() => run(() => openboard(one))}>Open board<span class="s">↵</span></button>
        <button class="mi" type="button" onclick={() => run(() => edit(one))}>Rename</button>
      {:else if one?.kind === 'note'}
        <button class="mi" type="button" onclick={() => run(() => edit(one))}>Edit note<span class="s">E</span></button>
      {:else if one?.kind === 'column'}
        <button class="mi" type="button" onclick={() => run(() => edit(one))}>Rename</button>
        <button class="mi" type="button" onclick={() => run(() => update({ [one.id]: { collapsed: !one.collapsed } }))}>
          {one.collapsed ? 'Expand' : 'Collapse'}
        </button>
      {/if}
      {#if one && one.kind !== 'image'}<div class="msep"></div>{/if}
      <button class="mi" type="button" onclick={() => run(() => duplicate(app.sel))}>Duplicate<span class="s">⌘D</span></button>
      {#if one?.kind === 'link'}
        <button class="mi" type="button" onclick={() => run(() => navigator.clipboard.writeText(one.url ?? ''))}>
          Copy link<span class="s">⌘⇧C</span>
        </button>
      {/if}
      <button class="mi" type="button" onclick={() => app.menu && (app.menu.pick = true)}>
        Move to board…<span class="s">M</span>
      </button>
      <div class="msep"></div>
      <button class="mi danger" type="button" onclick={() => run(() => remove(app.sel))}>Delete<span class="s">⌫</span></button>
    {/if}
  </div>
{/if}
