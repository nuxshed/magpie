<script lang="ts">
  import {
    addboard,
    addcolumn,
    addnote,
    alive,
    app,
    current,
    duplicate,
    items,
    openboard,
    remove,
    sendto,
    setcover,
    startcrop,
    togglelayout,
    up,
    update
  } from '../board.svelte'
  import { fit, toworld } from '../canvas/view.svelte'
  import { pickthumb } from '../input/paste'
  import { openlink, picture, type item } from '../model'

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

  const pic = $derived(one && app.current !== 'home' ? picture(one) : undefined)
  const pinned = $derived(current()?.cover ?? [])
  const child = $derived(one?.kind === 'board' ? app.boards[one.board ?? ''] : undefined)

  /** pin a picture to this board's cover, or unpin it, three at most */
  const pin = (a: string) =>
    setcover(app.current, pinned.includes(a) ? pinned.filter((x) => x !== a) : [...pinned, a].slice(-3))

  const moving = () => sel.filter((i) => !app.sel.includes(i.parent ?? ''))
  const edit = (i: item) => (app.editing = i.id)
  const here = () => toworld(app.menu?.x ?? 0, app.menu?.y ?? 0)

  /** fade and shrink a little on close */
  function shut(node: Element) {
    return { duration: parseFloat(getComputedStyle(node).getPropertyValue('--d-fast')), css: (t: number) => `opacity:${t};transform:scale(${0.97 + 0.03 * t})` }
  }
</script>

{#if app.menu && pos}
  <div
    class="pop menu"
    out:shut
    role="menu"
    tabindex="-1"
    style:left="{pos.x}px"
    style:top="{pos.y}px"
    bind:offsetHeight={h}
    onpointerdown={(e) => e.stopPropagation()}
  >
    {#if !sel.length}
      <button class="mi" type="button" onclick={() => run(() => addnote(here()))}>Add note<span class="s">N</span></button>
      <button class="mi" type="button" onclick={() => run(() => addcolumn(here()))}>Add column<span class="s">C</span></button>
      <button class="mi" type="button" onclick={() => run(() => addboard(here()))}>Add board<span class="s">B</span></button>
      <div class="msep"></div>
      <button class="mi" type="button" onclick={() => run(() => (app.sel = items().filter((i) => !i.parent).map((i) => i.id)))}>
        Select all<span class="s">⌘A</span>
      </button>
      <button class="mi" type="button" onclick={() => run(fit)}>Zoom to fit<span class="s">⇧1</span></button>
      {#if current()?.parent}
        <button class="mi" type="button" onclick={() => run(up)}>Up one level<span class="s">[</span></button>
      {/if}
    {:else if app.menu.pick}
      <div class="pick">
      <div class="rl">Move to board</div>
      {#each dests as d (d.id)}
        <button class="mi" type="button" onclick={() => run(() => sendto(moving(), d.id))}>
          {d.names.at(-1)}<span class="s">{d.names.slice(0, -1).join(' / ')}</span>
        </button>
      {:else}
        <div class="mi s">No other boards</div>
      {/each}
      </div>
    {:else}
      {#if one?.kind === 'link'}
        <button class="mi" type="button" onclick={() => run(() => openlink(one.url))}>
          Open link<span class="s">↵</span>
        </button>
        <button class="mi" type="button" onclick={() => run(() => edit(one))}>Edit details<span class="s">E</span></button>
        <button class="mi" type="button" onclick={() => run(() => togglelayout([one.id]))}>
          {one.layout === 'compact' ? 'Large' : 'Compact'}<span class="s">L</span>
        </button>
        <button class="mi" type="button" onclick={() => run(() => pickthumb(one.id))}>Change image…</button>
        {#if one.thumb}
          <button class="mi" type="button" onclick={() => run(() => update({ [one.id]: { thumb: undefined } }))}>
            Remove image
          </button>
        {/if}
      {:else if one?.kind === 'board'}
        <button class="mi" type="button" onclick={() => run(() => openboard(one))}>Open board<span class="s">↵</span></button>
        <button class="mi" type="button" onclick={() => run(() => edit(one))}>Rename</button>
        {#if child}
          <button class="mi" type="button" onclick={() => run(() => (app.covering = child.id))}>Choose cover…</button>
        {/if}
      {:else if one?.kind === 'note'}
        <button class="mi" type="button" onclick={() => run(() => edit(one))}>Edit note<span class="s">E</span></button>
      {:else if one?.kind === 'column'}
        <button class="mi" type="button" onclick={() => run(() => edit(one))}>Rename</button>
        <button class="mi" type="button" onclick={() => run(() => update({ [one.id]: { collapsed: !one.collapsed } }))}>
          {one.collapsed ? 'Expand' : 'Collapse'}
        </button>
      {/if}
      {#if one && picture(one)}
        <button class="mi" type="button" onclick={() => run(() => startcrop(one.id))}>Crop image…</button>
      {/if}
      {#if pic}
        <button class="mi" type="button" onclick={() => run(() => pin(pic))}>
          {pinned.includes(pic) ? 'Remove from cover' : 'Add to cover'}
        </button>
      {/if}
      {#if one}<div class="msep"></div>{/if}
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
