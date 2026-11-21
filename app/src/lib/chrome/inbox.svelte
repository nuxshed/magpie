<script lang="ts">
  import { alive, app, discard, paths, redirect, tail, unbox, waiting } from '../board.svelte'
  import { center, onscreen, place, toworld } from '../canvas/view.svelte'
  import { coarse, igembed, openlink, type item } from '../model'
  import Picture from '../cards/picture.svelte'
  import { typing } from '../input/keys'

  let open = $state(false)
  let full = $state(false)
  let all = $state(false)
  let dragging = $state(false)

  const list = $derived(waiting())
  const names = $derived(Object.fromEntries(Object.entries(paths()).map(([p, id]) => [id, p])))
  const dest = (i: item) => (i.dest && alive(i.dest) ? i.dest : '')
  const mine = $derived(list.filter((i) => dest(i) === app.current || (app.current === 'home' && !dest(i))))
  const groups = $derived.by(() => {
    if (!all) return [{ id: app.current, label: '', items: mine }]
    const out: Record<string, item[]> = {}
    for (const i of list) (out[dest(i)] ??= []).push(i)
    return Object.entries(out)
      .map(([id, items]) => ({ id, label: id ? names[id] : 'Unsorted', items }))
      .sort((a, b) => (a.id ? 1 : 0) - (b.id ? 1 : 0) || a.label.localeCompare(b.label))
  })

  $effect(() => {
    app.current
    all = false
  })

  /** put a card on the board: below the last card in the flat view, else near the middle of the view, left of the tray when it is open, clear of other cards when there is room in view */
  function put(i: item) {
    if (app.flat) return unbox(i.id, tail(), null)
    const c = open && !full && innerWidth > 720 ? toworld((innerWidth - 356) / 2, innerHeight / 2) : center()
    const at = { x: c.x - i.w / 2, y: c.y - 100 }
    const p = place(i.w, 200, at, false)
    unbox(i.id, onscreen({ ...p, w: i.w, h: 200 }) ? p : at, null)
  }

  /** a card for another board, which can be sent there */
  const away = (i: item) => !!dest(i) && dest(i) !== app.current
  const host = (u = '') => u.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]

  /** open a card's link, playing instagram in the overlay on desktop */
  function view(i: item) {
    if (i.kind !== 'link') return
    if (igembed(i.url) && !coarse()) app.playing = i.url!
    else openlink(i.url)
  }

  /** touch screens open the inbox full screen, others as a tray */
  function toggle() {
    if (coarse()) open = full = !full
    else open = !open
    all = false
  }

  function close() {
    full = false
    if (coarse()) open = false
  }

  function key(e: KeyboardEvent) {
    if (e.key.toLowerCase() === 'i' && !e.metaKey && !e.ctrlKey && !e.altKey && !typing(e.target)) {
      open = full = !full
      return
    }
    if (e.key !== 'Escape') return
    if (full) close()
    else open = false
  }
</script>

<svelte:window
  onkeydown={key}
  onpointerdown={(e) => open && !full && !(e.target as Element).closest('.inbox') && (open = false)}
/>

{#snippet actions(i: item)}
  <div class="acts">
  <button class="q" type="button" title="Add to this board" onclick={(e) => (e.stopPropagation(), put(i))}>Add</button>
  {#if away(i)}
    <button class="q" type="button" title="Send to {names[dest(i)]}" onclick={(e) => (e.stopPropagation(), unbox(i.id))}>Send</button>
  {/if}
  <select
    class="q mv"
    title="Move to another board's inbox"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
    onchange={(e) => redirect(i.id, e.currentTarget.value || undefined)}
  >
    <option value="_" selected disabled hidden>Move</option>
    <option value="">Unsorted</option>
    {#each Object.entries(names) as [id, p] (id)}<option value={id}>{p}</option>{/each}
  </select>
  <button class="q x" type="button" aria-label="Remove" onclick={(e) => (e.stopPropagation(), discard(i.id))}>×</button>
  </div>
{/snippet}

{#snippet text(i: item)}
  <div class="t">{i.kind === 'note' ? i.text : i.title || i.url}</div>
  {#if i.kind === 'link'}<div class="url">{i.site || host(i.url)}</div>{/if}
{/snippet}

{#snippet row(i: item)}
  <div
    class="row"
    role="button"
    tabindex="0"
    draggable="true"
    title="Drag onto the board, or Add"
    onclick={() => view(i)}
    onkeydown={(e) => e.key === 'Enter' && view(i)}
    ondragstart={(e) => {
      e.dataTransfer?.setData('text/x-magpie-inbox', i.id)
      dragging = true
    }}
    ondragend={() => (dragging = false)}
  >
    <div class="th">
      {#if i.thumb}<Picture asset={i.thumb} />{:else}<span>{i.kind === 'note' ? '¶' : '↗'}</span>{/if}
    </div>
    <div class="tx">{@render text(i)}</div>
    {@render actions(i)}
  </div>
{/snippet}

{#snippet tile(i: item)}
  <div class="tile" class:link={i.kind === 'link'} role="button" tabindex="0" onclick={() => view(i)} onkeydown={(e) => e.key === 'Enter' && view(i)}>
    {#if i.thumb}<Picture asset={i.thumb} />{/if}
    <div class="cap">
      <div class="tx">{@render text(i)}</div>
      {@render actions(i)}
    </div>
  </div>
{/snippet}

{#snippet tabs()}
  <div class="tabs">
    <button class="q" class:on={!all} type="button" onclick={() => (all = false)}>This board <span class="n">{mine.length}</span></button>
    <button class="q" class:on={all} type="button" onclick={() => (all = true)}>All <span class="n">{list.length}</span></button>
  </div>
{/snippet}

{#snippet empty()}
  {#if !groups.some((g) => g.items.length)}
    <div class="none">{all ? 'Nothing waiting. Share to Magpie from your phone and it shows up here.' : 'Nothing waiting for this board.'}</div>
  {/if}
{/snippet}

<div class="inbox">
  <button class="q btn" class:on={open} type="button" aria-label="Inbox" onclick={toggle}>
    <svg viewBox="0 0 14 14"><path d="M1.5 8.5h3l1 1.5h3l1-1.5h3M1.5 8.5l1.5-6h8l1.5 6v3h-11z" /></svg>
    {#if mine.length}<span class="n">{mine.length}</span>{/if}
  </button>
  {#if open && !full}
    <div class="pop tray" class:dragging role="dialog" aria-label="Inbox">
      <div class="head">
        {@render tabs()}
        <button class="q" type="button" aria-label="Full screen" title="Full screen" onclick={() => (full = true)}>
          <svg viewBox="0 0 14 14"><path d="M8.5 1.5h4v4M5.5 12.5h-4v-4M12.5 1.5l-4.5 4.5M1.5 12.5l4.5-4.5" /></svg>
        </button>
      </div>
      <div class="body">
        {#each groups as g (g.id)}
          {#if g.label}<div class="rl">{g.label}</div>{/if}
          {#each g.items as i (i.id)}{@render row(i)}{/each}
        {/each}
        {@render empty()}
      </div>
    </div>
  {/if}
  {#if full}
    <div class="full" role="dialog" aria-label="Inbox">
      <div class="head">
        {@render tabs()}
        <button class="q" type="button" onclick={close}>Close</button>
      </div>
      <div class="body">
        {#each groups as g (g.id)}
          {#if g.label}<div class="rl">{g.label}</div>{/if}
          <div class="grid">
            {#each g.items as i (i.id)}{@render tile(i)}{/each}
          </div>
        {/each}
        {@render empty()}
      </div>
    </div>
  {/if}
</div>

<style>
  .inbox {
    display: contents;
  }
  .n {
    font-variant-numeric: tabular-nums;
  }
  .btn svg {
    width: 13px;
    height: 13px;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 4px 2px;
  }
  .tabs {
    display: flex;
    gap: 2px;
  }
  .tabs .n {
    color: var(--ink-3);
  }
  .tray {
    right: 0;
    bottom: calc(100% + var(--s-2));
    width: min(340px, calc(100vw - 32px));
    max-height: min(520px, calc(100dvh - 120px));
    display: flex;
    flex-direction: column;
    padding: 2px 4px 6px;
    transition: opacity var(--d-fast) var(--ease);
  }
  .tray .body {
    overflow: auto;
  }
  .tray.dragging {
    opacity: 0.4;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 6px;
    border-radius: 5px;
    cursor: grab;
  }
  .row:hover {
    background: var(--surface-2);
  }
  .th {
    flex: none;
    width: 36px;
    height: 36px;
    border-radius: 4px;
    overflow: hidden;
    background: var(--surface-2);
    display: grid;
    place-items: center;
    color: var(--ink-3);
    font-size: 13px;
  }
  .th :global(img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .tx {
    flex: 1;
    min-width: 0;
  }
  .t {
    font-size: 13px;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .acts {
    flex: none;
    display: flex;
    align-items: center;
    gap: 2px;
    opacity: 0;
  }
  .row:hover .acts,
  .row:focus-within .acts,
  .tile:hover .acts,
  .tile:focus-within .acts {
    opacity: 1;
  }
  .full {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: var(--canvas);
    display: flex;
    flex-direction: column;
  }
  .full .head {
    padding: 12px 16px;
  }
  .full .body {
    flex: 1;
    overflow: auto;
    padding: 0 16px 24px;
  }
  .full .rl {
    padding: 16px 2px 8px;
  }
  .grid {
    columns: 240px;
    column-gap: 12px;
  }
  .tile {
    break-inside: avoid;
    margin-bottom: 12px;
    background: var(--surface);
    border-radius: 6px;
    box-shadow: var(--sh-0);
    overflow: hidden;
  }
  .tile.link {
    cursor: pointer;
  }
  .tile:hover {
    box-shadow: var(--sh-1);
  }
  .tile :global(img) {
    display: block;
    width: 100%;
  }
  .cap {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 6px 8px 10px;
  }
  .tile .t {
    white-space: normal;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
  }
  .mv {
    appearance: none;
    max-width: 64px;
  }
  .none {
    padding: 20px 10px;
    color: var(--ink-3);
    font-size: 13px;
  }
  @media (pointer: coarse) {
    .acts {
      opacity: 1;
    }
  }
  @media (max-width: 640px) {
    .tray {
      position: fixed;
      left: 8px;
      right: 8px;
      bottom: 56px;
      width: auto;
      max-height: 70dvh;
    }
    .row,
    .cap {
      flex-wrap: wrap;
    }
    .row .acts {
      flex-basis: 100%;
      padding-left: 44px;
    }
    .cap .acts {
      flex-basis: 100%;
    }
    .full .head {
      padding: 8px 12px;
    }
    .full .body {
      padding: 0 12px 24px;
    }
    .grid {
      columns: 1;
    }
  }
</style>
