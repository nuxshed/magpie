<script lang="ts">
  import { alive, app, cover, current, discard, href, items, owner, paths, peek, redirect, say, setpile, under, unbox, up } from '../board.svelte'
  import { coarse, frameof, igembed, type item } from '../model'
  import { pastetext, pickimages } from '../input/paste'
  import Acts from '../chrome/acts.svelte'
  import Picture from '../cards/picture.svelte'

  let el = $state<HTMLDivElement>()
  let w = $state(0)
  let q = $state('')
  let over = $state('')
  let dragging = $state(false)
  let menu = $state<{ x: number; y: number; i?: item; pick?: boolean } | null>(null)
  let mh = $state(0)
  let pressed = false
  const touch = coarse()

  const gap = $derived(w < 600 ? 10 : 20)
  const n = $derived(Math.max(2, Math.floor((w + gap) / (230 + gap))))
  const colw = $derived((w - gap * (n - 1)) / n)
  const names = $derived(Object.fromEntries(Object.entries(paths()).map(([p, id]) => [id, p])))
  const scope = $derived(under(app.current))
  const shown = $derived(scope.filter((i) => !q || words(i).includes(q.toLowerCase())))
  const subs = $derived(
    items()
      .filter((i) => i.kind === 'board' && i.board && alive(i.board))
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((i) => ({ id: i.board!, name: app.boards[i.board!].name, pic: cover(i.board!)[0], n: under(i.board!).length }))
  )
  const pos = $derived(menu && { x: Math.min(menu.x, innerWidth - 240), y: Math.min(menu.y, innerHeight - mh - 8) })

  $effect(() => {
    app.current
    q = ''
    menu = null
    if (el) el.scrollTop = 0
  })

  /** a board's path below the open board, unsorted for home itself */
  function label(id: string) {
    if (id === 'home') return 'Unsorted'
    if (id === app.current) return app.boards[id]?.name ?? ''
    const here = app.current === 'home' ? '' : names[app.current] + ' / '
    return names[id]?.replace(here, '') ?? ''
  }

  const tints = [1, 3, 11, 6, 5, 12, 7]
  /** the same placeholder colour a board's card uses */
  const tint = (id: string) => tints[[...id].reduce((n, ch) => n + ch.charCodeAt(0), 0) % tints.length]
  const words = (i: item) => [i.title, i.desc, i.text, i.site, i.url].join(' ').toLowerCase()
  const host = (u = '') => u.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]

  /** how long ago a card arrived, like 5m, 3h, 2d or 12 Nov */
  function ago(t = 0) {
    const s = (Date.now() - t) / 1000
    if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m`
    if (s < 86400) return `${Math.round(s / 3600)}h`
    if (s < 604800) return `${Math.round(s / 86400)}d`
    return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  }

  /** spread cards over the columns, each into the shortest so far, so they read newest first from left to right */
  function lay(list: item[]) {
    const cols = Array.from({ length: n }, () => ({ h: 0, items: [] as item[] }))
    for (const i of list) {
      const c = cols.reduce((a, b) => (b.h < a.h ? b : a))
      c.items.push(i)
      c.h += (i.thumb || i.asset ? colw / frameof(i) : 140) + 56
    }
    return cols
  }

  /** right click opens the card's menu, or the pile's on empty space */
  function context(e: MouseEvent) {
    const t = e.target as Element
    if (t.closest('input, .subs')) return
    e.preventDefault()
    const id = t.closest<HTMLElement>('[data-pid]')?.dataset.pid
    menu = { x: e.clientX, y: e.clientY, i: scope.find((i) => i.id === id) }
  }

  /** a still press of 450ms on a touch screen opens the card's menu, a move cancels it */
  function hold(e: PointerEvent, i: item) {
    pressed = false
    if (e.pointerType !== 'touch') return
    const { clientX: x, clientY: y } = e
    const t = setTimeout(() => {
      stop()
      pressed = true
      navigator.vibrate?.(10)
      menu = { x: x + 8, y: y + 8, i }
    }, 450)
    const move = (m: PointerEvent) => Math.hypot(m.clientX - x, m.clientY - y) > 8 && stop()
    const stop = () => {
      clearTimeout(t)
      removeEventListener('pointermove', move)
      removeEventListener('pointerup', stop)
      removeEventListener('pointercancel', stop)
    }
    addEventListener('pointermove', move)
    addEventListener('pointerup', stop)
    addEventListener('pointercancel', stop)
  }

  function open(i: item) {
    if (pressed) pressed = false
    else peek(i)
  }

  /** move a dragged card into a sub-board's pile */
  function drop(e: DragEvent, id: string) {
    e.preventDefault()
    e.stopPropagation()
    over = ''
    const card = e.dataTransfer?.getData('text/x-magpie-inbox')
    if (card) redirect(card, id)
  }

  function run(fn: () => void) {
    menu = null
    fn()
  }

  function copy(url = '') {
    navigator.clipboard.writeText(url).then(() => say('Link copied', false))
  }

  /** fade and shrink a little on close */
  function shut(node: Element) {
    return { duration: parseFloat(getComputedStyle(node).getPropertyValue('--d-fast')), css: (t: number) => `opacity:${t};transform:scale(${0.97 + 0.03 * t})` }
  }
</script>

<svelte:window
  onkeydowncapture={(e) => menu && e.key === 'Escape' && (e.stopImmediatePropagation(), (menu = null))}
  onpointerdown={(e) => menu && !(e.target as Element).closest('.pmenu') && (menu = null)}
/>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="pile" bind:this={el} oncontextmenu={context} onscroll={() => (menu = null)}>
  <div class="head">
    <label class="find">
      <svg viewBox="0 0 14 14" aria-hidden="true"><circle cx="6" cy="6" r="4" /><path d="M9 9l3.5 3.5" /></svg>
      <input
        type="search"
        placeholder="Search the pile"
        bind:value={q}
        onkeydown={(e) => {
          if (e.key !== 'Escape') return
          e.stopPropagation()
          if (q) q = ''
          else e.currentTarget.blur()
        }}
      />
    </label>
  </div>
  {#if subs.length}
    <nav class="subs" class:dragging aria-label="Boards inside">
      {#each subs as b (b.id)}
        <a
          class="sb"
          class:over={over === b.id}
          href={href(b.id)}
          ondragover={(e) => {
            e.preventDefault()
            e.stopPropagation()
            over = b.id
          }}
          ondragleave={() => over === b.id && (over = '')}
          ondrop={(e) => drop(e, b.id)}
        >
          <div class="sp c{tint(b.id)}">{#if b.pic}<Picture asset={b.pic} />{/if}</div>
          <div class="sn"><span>{b.name}</span>{#if b.n}<span class="sc">{b.n}</span>{/if}</div>
        </a>
      {/each}
    </nav>
  {/if}
  <div class="lanes" bind:clientWidth={w} style:gap="{gap}px">
    {#each lay(shown) as c, k (k)}
      <div class="lane" style:gap="{gap}px">
        {#each c.items as i, m (i.id)}
          {@const pic = i.thumb ?? i.asset}
          <article class="cell" data-pid={i.id} style:animation-delay="{Math.min(m * n + k, 12) * 18}ms">
            <div
              class="face {pic ? 'pic' : i.kind === 'note' ? 'txt' : 'web'}"
              role="button"
              tabindex="0"
              draggable={!touch}
              style:aspect-ratio={pic ? frameof(i) : undefined}
              onclick={() => open(i)}
              onkeydown={(e) => e.key === 'Enter' && peek(i)}
              onpointerdown={(e) => hold(e, i)}
              ondragstart={(e) => {
                e.dataTransfer?.setData('text/x-magpie-inbox', i.id)
                dragging = true
              }}
              ondragend={() => {
                dragging = false
                over = ''
              }}
            >
              {#if pic}
                <Picture asset={pic} />
                {#if igembed(i.url)}<span class="play" aria-hidden="true"></span>{/if}
              {:else if i.kind === 'note'}
                <p>{i.text}</p>
              {:else}
                <div class="lt">{i.title || host(i.url)}</div>
                <div class="lh">{host(i.url)}</div>
              {/if}
              <Acts {i} />
            </div>
            <div class="info">
              {#if pic && (i.title || i.desc)}<div class="line">{i.title || i.desc}</div>{/if}
              <div class="sub">
                {#if pic && i.kind === 'link'}<span>{i.site || host(i.url)}</span>{/if}
                {#if owner(i) !== app.current}<span class="where">{label(owner(i))}</span>{/if}
                <span class="age">{ago(i.added ?? i.order)}</span>
              </div>
            </div>
          </article>
        {/each}
      </div>
    {/each}
  </div>
  {#if !shown.length}
    <div class="empty">
      {#if q}
        <div class="hd">Nothing matches “{q}”.</div>
      {:else}
        <div class="hd">The pile is empty.</div>
        <div>Share links to Magpie from your phone, or paste them here. They wait in the pile, unarranged, until you place them.</div>
      {/if}
    </div>
  {/if}
</div>

{#if menu && pos}
  {@const i = menu.i}
  <div class="pop menu pmenu" role="menu" tabindex="-1" out:shut style:left="{pos.x}px" style:top="{pos.y}px" bind:offsetHeight={mh}>
    {#if i && menu.pick}
      <div class="pick">
        <div class="rl">Move to</div>
        <button class="mi" type="button" disabled={owner(i) === 'home' && !i.dest} onclick={() => run(() => redirect(i.id))}>Unsorted</button>
        {#each Object.entries(names) as [id, p] (id)}
          {@const parts = p.split(' / ')}
          <button class="mi" type="button" disabled={id === owner(i)} onclick={() => run(() => redirect(i.id, id))}>
            {parts.at(-1)}<span class="s">{parts.slice(0, -1).join(' / ')}</span>
          </button>
        {/each}
      </div>
    {:else if i}
      {#if i.kind === 'link'}
        <button class="mi" type="button" onclick={() => run(() => peek(i))}>Open<span class="s">↵</span></button>
      {/if}
      <button class="mi" type="button" onclick={() => run(() => unbox(i.id))}>
        {owner(i) === app.current ? 'Place on the canvas' : `Place on ${app.boards[owner(i)]?.name}`}
      </button>
      <button class="mi" type="button" onclick={() => menu && (menu = { ...menu, pick: true })}>Move to…</button>
      {#if i.kind === 'link'}
        <button class="mi" type="button" onclick={() => run(() => copy(i.url))}>Copy link</button>
      {/if}
      <div class="msep"></div>
      <button class="mi danger" type="button" onclick={() => run(() => discard(i.id))}>Remove</button>
    {:else}
      <button class="mi" type="button" onclick={() => run(() => pastetext({ x: 0, y: 0 }))}>Paste<span class="s">⌘V</span></button>
      <button class="mi" type="button" onclick={() => run(() => pickimages({ x: 0, y: 0 }))}>Add image…</button>
      <div class="msep"></div>
      <button class="mi" type="button" onclick={() => run(() => setpile(false))}>Show the canvas<span class="s">I</span></button>
      {#if current()?.parent}
        <button class="mi" type="button" onclick={() => run(up)}>Up one level<span class="s">[</span></button>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .pile {
    position: absolute;
    inset: 0;
    overflow: auto;
    touch-action: pan-y;
    padding: 64px 32px 72px;
    background: var(--canvas);
    animation: enter var(--d-base) var(--ease) both;
  }
  :global(.app:has(.pile) :is(.bl, .br)) {
    display: none;
  }
  .head {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px 12px;
    margin: 4px 0 16px;
  }
  .find {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 260px;
    height: 34px;
    padding: 0 12px;
    border-radius: var(--r-l);
    background: var(--surface);
    box-shadow: var(--sh-0);
    color: var(--ink-3);
  }
  .find:focus-within {
    box-shadow:
      var(--sh-0),
      0 0 0 1.5px var(--sel);
  }
  .find svg {
    flex: none;
    width: 14px;
    height: 14px;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.5;
  }
  .find input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: none;
    outline: none;
    font: 13px var(--f-ui);
    color: var(--ink);
  }
  .find input::-webkit-search-cancel-button {
    display: none;
  }
  .subs {
    display: flex;
    gap: 12px;
    margin: 0 -32px 24px;
    padding: 2px 32px 4px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .sb {
    flex: none;
    width: 148px;
    text-decoration: none;
    color: var(--ink);
  }
  .sp {
    height: 92px;
    border-radius: var(--r-m);
    overflow: hidden;
    box-shadow: var(--sh-0);
    transition:
      transform var(--d-base) var(--ease-settle),
      box-shadow var(--d-base) var(--ease);
  }
  .sp :global(img) {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .sb:hover .sp {
    transform: translateY(-2px);
    box-shadow: var(--sh-1);
  }
  .dragging .sp {
    box-shadow: inset 0 0 0 1.5px var(--line);
  }
  .sb.over .sp {
    transform: scale(1.04);
    box-shadow: 0 0 0 2px var(--accent);
  }
  .sb:focus-visible {
    outline: none;
  }
  .sb:focus-visible .sp {
    outline: 2px solid var(--sel);
    outline-offset: 2px;
  }
  .sn {
    display: flex;
    justify-content: space-between;
    gap: 6px;
    padding: 7px 2px 0;
    font-size: 13px;
    font-weight: 500;
  }
  .sn span:first-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sc {
    flex: none;
    font-weight: 400;
    color: var(--ink-3);
    font-variant-numeric: tabular-nums;
  }
  .pmenu {
    position: fixed;
    width: 232px;
    z-index: 30;
  }
  .lanes {
    display: flex;
    align-items: flex-start;
  }
  .lane {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .cell {
    animation: rise var(--d-slow) var(--ease-settle) both;
  }
  .face {
    position: relative;
    border-radius: var(--r-l);
    overflow: hidden;
    background: var(--surface);
    box-shadow: var(--sh-0);
    cursor: pointer;
    transition:
      transform var(--d-base) var(--ease-settle),
      box-shadow var(--d-base) var(--ease);
  }
  .face.txt {
    cursor: default;
  }
  .face {
    -webkit-touch-callout: none;
    user-select: none;
  }
  .face:hover {
    transform: translateY(-2px);
    box-shadow: var(--sh-1);
  }
  .face:focus-visible {
    outline: 2px solid var(--sel);
    outline-offset: 2px;
  }
  .face :global(img) {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .face.pic {
    background: var(--surface-2);
  }
  .face p {
    margin: 0;
    padding: 16px 18px 18px;
    font-size: 14px;
    line-height: 1.5;
    color: var(--ink);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-line-clamp: 10;
    line-clamp: 10;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .face.web {
    padding: 18px 18px 16px;
    background: var(--surface-2);
  }
  .lt {
    font: 19px/1.2 var(--f-display);
    color: var(--ink);
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .lh {
    margin-top: 14px;
    font-size: 12px;
    color: var(--ink-3);
  }
  .play {
    position: absolute;
    left: 10px;
    bottom: 10px;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: rgb(0 0 0 / 0.4);
    backdrop-filter: blur(8px);
  }
  .play::after {
    content: '';
    position: absolute;
    left: 10px;
    top: 8px;
    border-left: 8px solid #fff;
    border-top: 5px solid transparent;
    border-bottom: 5px solid transparent;
  }
  .face :global(.acts) {
    position: absolute;
    right: 8px;
    top: 8px;
    padding: 2px;
    border-radius: 16px;
    background: rgb(18 18 18 / 0.5);
    backdrop-filter: blur(10px);
    opacity: 0;
    transform: translateY(-4px);
    transition:
      opacity var(--d-fast) var(--ease),
      transform var(--d-fast) var(--ease);
  }
  .face :global(.ib) {
    color: rgb(255 255 255 / 0.85);
  }
  .face :global(.ib:hover) {
    color: #fff;
    background: rgb(255 255 255 / 0.16);
  }
  .face:hover :global(.acts),
  .face:focus-within :global(.acts) {
    opacity: 1;
    transform: none;
  }
  .info {
    padding: 8px 4px 0;
  }
  .line {
    font-size: 13px;
    line-height: 1.35;
    color: var(--ink);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin-bottom: 2px;
  }
  .sub {
    display: flex;
    gap: 6px;
    font-size: 12px;
    color: var(--ink-3);
    white-space: nowrap;
    min-width: 0;
  }
  .sub span {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sub span + span::before {
    content: '·';
    margin-right: 6px;
  }
  .where {
    color: var(--ink-2);
  }
  .age {
    flex: none;
  }
  .empty {
    padding: 15vh 0;
    max-width: 360px;
    margin: 0 auto;
    text-align: center;
    font-size: 13px;
    line-height: 1.5;
    color: var(--ink-3);
  }
  .empty .hd {
    font: 28px/1.15 var(--f-display);
    color: var(--ink);
    margin-bottom: 8px;
  }
  @keyframes enter {
    from {
      opacity: 0;
    }
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .pile,
    .cell {
      animation: none;
    }
    .face:hover {
      transform: none;
    }
  }
  @media (pointer: coarse) {
    .face :global(.acts) {
      opacity: 1;
      transform: none;
    }
    .face:hover {
      transform: none;
    }
    .face p,
    .face.web {
      padding-top: 44px;
    }
  }
  @media (max-width: 640px) {
    .pile {
      padding: 60px 12px 72px;
    }
    .find {
      width: 100%;
    }
    .subs {
      margin: 0 -12px 16px;
      padding: 2px 12px 4px;
      gap: 10px;
    }
    .sb {
      width: 124px;
    }
    .sp {
      height: 80px;
    }
    .face :global(.ib) {
      width: 26px;
      height: 26px;
    }
    .lt {
      font-size: 17px;
    }
  }
</style>
