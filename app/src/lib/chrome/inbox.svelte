<script lang="ts">
  import { app, owner, paths, peek, setpile, tail, unbox, under } from '../board.svelte'
  import { center, onscreen, place, toworld } from '../canvas/view.svelte'
  import type { item } from '../model'
  import Acts from './acts.svelte'
  import Picture from '../cards/picture.svelte'
  import { typing } from '../input/keys'

  let open = $state(false)
  let dragging = $state(false)

  const list = $derived(under(app.current))
  const names = $derived(Object.fromEntries(Object.entries(paths()).map(([p, id]) => [id, p])))

  /** put a card on the board: below the last card in the flat view, else near the middle of the view, left of the tray, clear of other cards when there is room in view */
  function put(i: item) {
    if (app.flat) return unbox(i.id, tail(), null)
    const c = innerWidth > 720 ? toworld((innerWidth - 356) / 2, innerHeight / 2) : center()
    const at = { x: c.x - i.w / 2, y: c.y - 100 }
    const p = place(i.w, 200, at, false)
    unbox(i.id, onscreen({ ...p, w: i.w, h: 200 }) ? p : at, null)
  }

  const host = (u = '') => u.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]

  function key(e: KeyboardEvent) {
    if (e.key.toLowerCase() === 'i' && !e.metaKey && !e.ctrlKey && !e.altKey && !typing(e.target)) {
      open = false
      return setpile(!app.pile)
    }
    if (e.key !== 'Escape' || typing(e.target)) return
    if (open) open = false
    else if (app.pile && !app.playing && !app.menu) setpile(false)
  }
</script>

<svelte:window onkeydown={key} onpointerdown={(e) => open && !(e.target as Element).closest('.inbox') && (open = false)} />

{#snippet row(i: item)}
  <div
    class="row"
    role="button"
    tabindex="0"
    draggable="true"
    title="Drag onto the board, or Add"
    onclick={() => peek(i)}
    onkeydown={(e) => e.key === 'Enter' && peek(i)}
    ondragstart={(e) => {
      e.dataTransfer?.setData('text/x-magpie-inbox', i.id)
      dragging = true
    }}
    ondragend={() => (dragging = false)}
  >
    <div class="th">
      {#if i.thumb}<Picture asset={i.thumb} />{:else}<span>{i.kind === 'note' ? '¶' : '↗'}</span>{/if}
    </div>
    <div class="tx">
      <div class="t">{i.kind === 'note' ? i.text : i.title || host(i.url)}</div>
      <div class="sub">{[i.kind === 'link' && (i.site || host(i.url)), owner(i) !== app.current && (owner(i) === 'home' ? 'Unsorted' : names[owner(i)]?.split(' / ').at(-1))].filter(Boolean).join(' · ')}</div>
    </div>
    <Acts {i} add={() => put(i)} />
  </div>
{/snippet}

<div class="inbox">
  <button class="q btn" class:on={open} type="button" aria-label="Pile" title="Pile" onclick={() => (open = !open)}>
    <svg viewBox="0 0 14 14"><path d="M1.5 8.5h3l1 1.5h3l1-1.5h3M1.5 8.5l1.5-6h8l1.5 6v3h-11z" /></svg>
    {#if list.length}<span class="n">{list.length}</span>{/if}
  </button>
  {#if open}
    <div class="pop tray" class:dragging role="dialog" aria-label="Pile">
      <div class="head">
        <div class="line">Pile <span class="n">{list.length}</span></div>
        <button class="q" type="button" aria-label="Open the pile" title="Open the pile (I)" onclick={() => ((open = false), setpile(true))}>
          <svg viewBox="0 0 14 14"><path d="M8.5 1.5h4v4M5.5 12.5h-4v-4M12.5 1.5l-4.5 4.5M1.5 12.5l4.5-4.5" /></svg>
        </button>
      </div>
      <div class="body">
        {#each list as i (i.id)}{@render row(i)}{/each}
        {#if !list.length}
          <div class="none">Nothing in the pile. Share to Magpie from your phone, or paste into the pile.</div>
        {/if}
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
  .line {
    padding: 0 6px;
    font-size: 13px;
    font-weight: 500;
    color: var(--ink);
  }
  .line .n {
    margin-left: 4px;
    font-weight: 400;
    color: var(--ink-3);
  }
  .sub {
    font-size: 12px;
    color: var(--ink-3);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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
    width: 40px;
    height: 40px;
    border-radius: var(--r-s);
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
  .row :global(.acts) {
    opacity: 0;
  }
  .row:hover :global(.acts),
  .row:focus-within :global(.acts) {
    opacity: 1;
  }
  .none {
    padding: 20px 10px;
    color: var(--ink-3);
    font-size: 13px;
  }
  @media (pointer: coarse) {
    .row :global(.acts) {
      opacity: 1;
    }
  }
  @media (max-width: 640px) {
    .btn,
    .tray {
      display: none;
    }
  }
</style>
