<script lang="ts">
  import { dev } from '$app/env'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { onMount, tick, untrack } from 'svelte'
  import { addnote, alive, app, current, droptarget, items, load, rect } from '../board.svelte'
  import type { item } from '../model'
  import Card from '../cards/card.svelte'
  import Add from '../chrome/add.svelte'
  import Menu from '../chrome/menu.svelte'
  import Selbar from '../chrome/selbar.svelte'
  import Top from '../chrome/top.svelte'
  import Zoom from '../chrome/zoom.svelte'
  import { onkey, typing } from '../input/keys'
  import { adddata } from '../input/paste'
  import { track } from '../input/track'
  import { get, put } from '../store/db'
  import { pointer, spot, toworld, view, zoomat } from './view.svelte'

  let el = $state<HTMLDivElement>()
  let world = $state<HTMLDivElement>()
  let marquee = $state<{ x: number; y: number; w: number; h: number } | null>(null)
  let space = $state(false)
  let panning = $state(false)
  const list = $derived.by(() => {
    const all = items()
    const cols = new Set(all.filter((i) => i.kind === 'column').map((i) => i.id))
    return all.filter((i) => !i.parent || !cols.has(i.parent) || app.live[i.id])
  })
  const blank = $derived(!!current() && !items().length)
  let seq = 0

  onMount(async () => {
    await load()
    if (dev && new URLSearchParams(location.search).has('seed')) {
      await (await import('../store/seed')).seed()
      await goto(location.pathname, { replace: true })
    }
    app.ready = true
  })

  $effect(() => {
    const id = page.params.id ?? 'home'
    if (app.ready) untrack(() => show(id))
  })

  /** the world transform that makes a card fill the view */
  function filled(i: item) {
    const r = rect(i)
    const z = view.zoom
    const s = Math.max(innerWidth / (r.w * z), innerHeight / (r.h * z))
    const cx = (r.x + r.w / 2) * z + view.x
    const cy = (r.y + r.h / 2) * z + view.y
    return `translate(${(view.x - cx) * s + innerWidth / 2}px, ${(view.y - cy) * s + innerHeight / 2}px) scale(${z * s})`
  }

  /** scale a board card up to fill the view as the board fades, or back down */
  function zoom(i: item, opening: boolean) {
    const css = getComputedStyle(world!)
    const frames = [
      { transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`, opacity: 1 },
      { transform: filled(i), opacity: 0 }
    ]
    return world!.animate(opening ? frames : frames.reverse(), {
      duration: parseFloat(css.getPropertyValue('--d-slow')),
      easing: css.getPropertyValue('--ease'),
      fill: 'forwards'
    })
  }

  /** switch to a board, keeping each board's own viewport */
  async function show(id: string) {
    if (id === app.current) return
    if (!alive(id)) return goto('/', { replace: true })
    const n = ++seq
    const from = app.current
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches
    const card = items().find((i) => i.kind === 'board' && i.board === id)
    const out = card && !still ? zoom(card, true) : null
    if (from) put('views', from, { ...view })
    const done = out && Promise.race([out.finished, new Promise((ok) => setTimeout(ok, 400))])
    const [v] = await Promise.all([get('views', id), done])
    if (n !== seq) return out?.cancel()
    Object.assign(view, v ?? { x: 0, y: 0, zoom: 1 })
    app.current = id
    app.sel = []
    app.editing = null
    app.last = null
    app.menu = null
    await tick()
    out?.cancel()
    const back = items().find((i) => i.kind === 'board' && i.board === from)
    if (still) return
    if (back) zoom(back, false).finished.then((a) => a.cancel())
    else world!.animate([{ opacity: 0 }, { opacity: 1 }], { duration: parseFloat(getComputedStyle(world!).getPropertyValue('--d-base')) })
  }

  $effect(() => {
    if (!app.ready) return
    const v = { ...view }
    const id = app.current
    const t = setTimeout(() => put('views', id, v), 300)
    return () => clearTimeout(t)
  })

  $effect(() => {
    const node = el!
    node.addEventListener('wheel', wheel, { passive: false })
    return () => node.removeEventListener('wheel', wheel)
  })

  /** pinch and cmd+scroll zoom around the cursor, plain scroll pans */
  function wheel(e: WheelEvent) {
    e.preventDefault()
    app.menu = null
    const k = e.deltaMode === 1 ? 16 : 1
    if (e.ctrlKey || e.metaKey) {
      const d = Math.max(-50, Math.min(50, e.deltaY * k))
      zoomat(view.zoom * 2 ** (-d / 100), e.clientX, e.clientY)
    } else {
      view.x -= e.deltaX * k
      view.y -= e.deltaY * k
    }
  }

  /** space+drag or middle mouse pans, anywhere */
  function grab(e: PointerEvent) {
    if (app.menu && !(e.target as Element).closest('.menu')) app.menu = null
    if (e.button !== 1 && !(space && e.button === 0)) return
    e.preventDefault()
    e.stopPropagation()
    const sx = view.x
    const sy = view.y
    panning = true
    track(
      e,
      (dx, dy) => {
        view.x = sx + dx
        view.y = sy + dy
      },
      () => (panning = false)
    )
  }

  /** press on empty canvas clears the selection, dragging draws a marquee */
  function down(e: PointerEvent) {
    if (e.target !== el || e.button !== 0) return
    const keep = e.shiftKey ? [...app.sel] : []
    app.sel = keep
    track(
      e,
      (dx, dy) => {
        const m = {
          x: Math.min(e.clientX, e.clientX + dx),
          y: Math.min(e.clientY, e.clientY + dy),
          w: Math.abs(dx),
          h: Math.abs(dy)
        }
        marquee = m
        const a = toworld(m.x, m.y)
        const b = toworld(m.x + m.w, m.y + m.h)
        const hit = list.filter((i) => {
          const r = rect(i)
          return r.x < b.x && r.x + r.w > a.x && r.y < b.y && r.y + r.h > a.y
        })
        app.sel = [...new Set([...keep, ...hit.map((i) => i.id)])]
      },
      () => (marquee = null)
    )
  }

  function move(e: PointerEvent) {
    pointer.x = e.clientX
    pointer.y = e.clientY
    pointer.inside = true
  }

  function keydown(e: KeyboardEvent) {
    if (e.code === 'Space' && !typing(e.target)) {
      e.preventDefault()
      space = true
    } else onkey(e)
  }

  function keyup(e: KeyboardEvent) {
    if (e.code !== 'Space') return
    if (!typing(e.target)) e.preventDefault()
    space = false
  }

  function paste(e: ClipboardEvent) {
    if (typing(e.target)) return
    e.preventDefault()
    adddata(e.clipboardData, spot())
  }

  function over(e: DragEvent) {
    e.preventDefault()
    const t = droptarget(toworld(e.clientX, e.clientY))
    if (t?.col !== app.target?.col || t?.slot !== app.target?.slot) app.target = t
  }

  function drop(e: DragEvent) {
    e.preventDefault()
    app.target = null
    adddata(e.dataTransfer, toworld(e.clientX, e.clientY))
  }
</script>

<svelte:window onkeydown={keydown} onkeyup={keyup} onpaste={paste} onblur={() => (space = false)} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="app"
  class:space
  class:panning
  class:grabbing={app.dragging}
  bind:this={el}
  onpointerdowncapture={grab}
  onpointerdown={down}
  onpointermove={move}
  onpointerleave={() => (pointer.inside = false)}
  onmousedown={(e) => e.button === 1 && e.preventDefault()}
  ondblclick={(e) => e.target === el && addnote(toworld(e.clientX, e.clientY))}
  oncontextmenu={(e) => !typing(e.target) && e.preventDefault()}
  ondragover={over}
  ondragleave={(e) => !el?.contains(e.relatedTarget as Node) && (app.target = null)}
  ondrop={drop}
>
  <div class="world" bind:this={world} style:transform="translate({view.x}px, {view.y}px) scale({view.zoom})">
    {#each list as item (item.id)}
      <Card card={item} />
    {/each}
    {#each app.guides as g, n (n)}
      <i
        class="guide"
        style:left="{g.x}px"
        style:top="{g.y}px"
        style:width="{Math.max(g.w, 1 / view.zoom)}px"
        style:height="{Math.max(g.h, 1 / view.zoom)}px"
      ></i>
    {/each}
  </div>
  {#if blank}
    <div class="blank">
      <div class="big">Paste or drop anything here.</div>
      <div>An image, a link or some text. It lands where your cursor is.</div>
      <div>Or press <span class="k">N</span> for a note, <span class="k">B</span> for a board.</div>
    </div>
  {/if}
  {#if marquee}
    <div
      class="marquee"
      style:left="{marquee.x}px"
      style:top="{marquee.y}px"
      style:width="{marquee.w}px"
      style:height="{marquee.h}px"
    ></div>
  {/if}
  <Selbar />
  <Menu />
  <Top />
  <Add />
  <Zoom />
</div>
