<script lang="ts">
  import { tick, untrack } from 'svelte'
  import { app, setalign, settext, update } from '../board.svelte'
  import { alignkey } from '../input/keys'
  import type { item } from '../model'
  import { highlight, nextmarker, render, toggle } from './markdown'

  let { card }: { card: item } = $props()

  const editing = $derived(app.editing === card.id)
  let text = $state('')
  let area = $state<HTMLTextAreaElement>()

  $effect(() => {
    if (!editing) return
    text = untrack(() => card.text ?? '')
    tick().then(() => {
      area?.focus({ preventScroll: true })
      area?.setSelectionRange(text.length, text.length)
    })
  })

  /** enter on a list line starts the next item, on an empty item it outdents, then ends the list */
  function enter(e: KeyboardEvent) {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing || !area) return
    const v = area.value
    const at = area.selectionStart
    const start = v.lastIndexOf('\n', at - 1) + 1
    const m = nextmarker(v.slice(start, at))
    if (!m) return
    e.preventDefault()
    const sp = v.slice(start).match(/^ {1,2}/)?.[0].length ?? 0
    if (m.empty && area.selectionEnd === at) {
      area.setSelectionRange(start, start + (sp || m.marker.length))
      document.execCommand('delete')
      if (sp) area.setSelectionRange(at - sp, at - sp)
    } else document.execCommand('insertText', false, `\n${m.next}`)
  }

  /** tab and shift+tab indent and outdent the list lines in the selection */
  function indent(e: KeyboardEvent) {
    if (e.key !== 'Tab' || !area) return
    const v = area.value
    const s = area.selectionStart
    const end = area.selectionEnd
    const a = v.lastIndexOf('\n', s - 1) + 1
    const b = v.indexOf('\n', end) < 0 ? v.length : v.indexOf('\n', end)
    const lines = v.slice(a, b).split('\n')
    if (!lines.every((l) => nextmarker(l))) return
    e.preventDefault()
    const out = lines.map((l) => (e.shiftKey ? l.replace(/^ {1,2}/, '') : '  ' + l))
    const text = out.join('\n')
    area.setSelectionRange(a, b)
    document.execCommand('insertText', false, text)
    area.setSelectionRange(Math.max(a, s + out[0].length - lines[0].length), end + text.length - (b - a))
  }

  /** wrap the selection in a mark, or unwrap it when it already has one */
  function wrap(mark: string) {
    if (!area) return
    const v = area.value
    const s = area.selectionStart
    const e = area.selectionEnd
    const n = mark.length
    const solo = (i: number) => mark !== '*' || v[i] !== '*'
    const sel = v.slice(s, e)
    if (v.slice(s - n, s) === mark && v.slice(e, e + n) === mark && solo(s - n - 1) && solo(e + n)) {
      area.setSelectionRange(s - n, e + n)
      document.execCommand('insertText', false, sel)
      area.setSelectionRange(s - n, e - n)
    } else {
      document.execCommand('insertText', false, mark + sel + mark)
      area.setSelectionRange(s + n, e + n)
    }
  }

  /** ⌘B and ⌘I mark bold and italic */
  function marks(e: KeyboardEvent) {
    if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return
    const k = e.key.toLowerCase()
    if (k !== 'b' && k !== 'i') return
    e.preventDefault()
    wrap(k === 'b' ? '**' : '*')
  }

  /** a click on a checkbox ticks it without picking up the note */
  function check(e: PointerEvent) {
    const box = (e.target as Element).closest<HTMLElement>('.box')
    if (!box) return
    e.stopPropagation()
    update({ [card.id]: { text: toggle(card.text ?? '', +box.dataset.n!) } })
  }

  /** save the edit and go back to rendered markdown */
  function done() {
    if (!text.trim() || text !== card.text) settext(card.id, text)
    app.editing = null
  }
</script>

{#if editing}
  <div class="mirror">{@html highlight(text) + ' '}</div>
  <textarea
    bind:this={area}
    bind:value={text}
    onblur={done}
    onkeydown={(e) => {
      if (e.key === 'Escape') area?.blur()
      enter(e)
      indent(e)
      marks(e)
      const a = alignkey(e)
      if (a) {
        e.preventDefault()
        setalign([card.id], a)
      }
    }}
    spellcheck="false"
  ></textarea>
{:else}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="md" onpointerdown={check} ondblclick={(e) => (e.target as Element).closest('.box') && e.stopPropagation()}>
    {@html render(card.text ?? '')}
  </div>
{/if}
