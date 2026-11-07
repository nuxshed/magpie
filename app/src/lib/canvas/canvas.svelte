<script lang="ts">
  import { dev } from '$app/env'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { onMount, tick, untrack } from 'svelte'
  import { addnote, alive, app, current, droptarget, endcrop, items, load, rect } from '../board.svelte'
  import type { item } from '../model'
  import Card from '../cards/card.svelte'
  import Add from '../chrome/add.svelte'
  import Coverpick from '../chrome/coverpick.svelte'
  import Croptool from '../chrome/croptool.svelte'
  import Menu from '../chrome/menu.svelte'
  import Selbar from '../chrome/selbar.svelte'
  import Top from '../chrome/top.svelte'
  import Zoom from '../chrome/zoom.svelte'
  import { onkey, typing } from '../input/keys'
  import { adddata } from '../input/paste'
  import { touch } from '../input/touch'
  import { track } from '../input/track'
  import { all, get, put } from '../store/db'
  import { fetchpreviews } from '../store/preview'
  import { start } from '../store/sync'
  import { signed } from '../auth'
  import { pointer, spot, toworld, view, zoomat } from './view.svelte'

  let el = $state<HTMLDivElement>()
  let world = $state<HTMLDivElement>()
  let marquee = $state<{ x: number; y: number; w: number; h: number } | null>(null)
  let space = $state(false)
  let panning = $state(false)
  let touched = false
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
    for (const v of await all<{ id?: string; n?: number; seen?: number }>('views'))
      if (v.id) app.visits[v.id] = { n: v.n ?? 0, seen: v.seen ?? 0 }
    app.ready = true
    if (signed() && !localStorage.getItem('seeded')) start()
    fetchpreviews()
    addEventListener('online', () => fetchpreviews())
  })

  /** save a board's viewport along with how often and when it was last opened */
  function keep(id: string, v = view) {
    put('views', id, { x: v.x, y: v.y, zoom: v.zoom, id, ...app.visits[id] })
  }

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
    if (from) keep(from)
    const done = out && Promise.race([out.finished, new Promise((ok) => setTimeout(ok, 400))])
    const [v] = await Promise.all([get<{ x: number; y: number; zoom: number }>('views', id), done])
    if (n !== seq) return out?.cancel()
    Object.assign(view, { x: v?.x ?? 0, y: v?.y ?? 0, zoom: v?.zoom ?? 1 })
    app.visits[id] = { n: (app.visits[id]?.n ?? 0) + 1, seen: Date.now() }
    keep(id)
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
    const t = setTimeout(() => keep(id, v), 300)
    return () => clearTimeout(t)
  })

  $effect(() => {
    const node = el!
    node.addEventListener('wheel', wheel, { passive: false })
    return () => node.removeEventListener('wheel', wheel)
  })

  /** keep the note being edited above the soft keyboard */
  function lift() {
    const r = document.querySelector(`[data-id="${app.editing}"]`)?.getBoundingClientRect()
    const v = visualViewport
    if (r && v) view.y -= Math.max(0, Math.min(r.bottom - (v.offsetTop + v.height - 16), r.top - 64))
  }

  $effect(() => {
    const v = visualViewport
    if (!v || !app.editing) return
    v.addEventListener('resize', lift)
    return () => v.removeEventListener('resize', lift)
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

  /** drag the view */
  function pan(e: PointerEvent) {
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

  /** space+drag or middle mouse pans anywhere, two fingers pinch */
  function grab(e: PointerEvent) {
    touched = e.pointerType === 'touch'
    if (app.menu && !(e.target as Element).closest('.menu')) app.menu = null
    if (app.cropping && !(e.target as Element).closest(`.cropbar, [data-id="${app.cropping}"]`)) endcrop(true)
    if (touched) {
      const a = document.activeElement
      if (a instanceof HTMLElement && typing(a) && a !== e.target) a.blur()
      if (touch(e)) return e.stopPropagation()
    }
    if (e.button !== 1 && !(space && e.button === 0)) return
    e.preventDefault()
    e.stopPropagation()
    pan(e)
  }

  /** press on empty canvas clears the selection, then a finger pans and a mouse draws a marquee */
  function down(e: PointerEvent) {
    if (e.target !== el || e.button !== 0) return
    const add = e.shiftKey || app.multi
    const keep = add ? [...app.sel] : []
    app.sel = keep
    if (touched && !app.multi) return pan(e)
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

  /** right click on empty canvas opens the canvas menu */
  function context(e: MouseEvent) {
    if (typing(e.target)) return
    e.preventDefault()
    if (e.target !== el) return
    app.sel = []
    app.menu = { x: e.clientX, y: e.clientY }
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
  ondblclickcapture={(e) => e.isTrusted && touched && e.stopPropagation()}
  ondblclick={(e) => e.target === el && addnote(toworld(e.clientX, e.clientY))}
  oncontextmenu={context}
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
      <div>An image, a link or some text. <span class="fine">It lands where your cursor is.</span></div>
      <div class="fine">Or press <span class="k">N</span> for a note, <span class="k">B</span> for a board.</div>
      <div class="coarse">Or add a note, column or board below.</div>
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
  <Coverpick />
  <Croptool />
  <Top />
  <Add />
  <Zoom />
</div>
