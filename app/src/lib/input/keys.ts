import {
  addboard,
  addcolumn,
  addnote,
  app,
  duplicate,
  getitem,
  items,
  nudge,
  openboard,
  redo,
  remove,
  undo,
  up
} from '../board.svelte'
import { fit, place, pointer, reset, step } from '../canvas/view.svelte'
import { widths } from '../model'

const arrows: Record<string, [number, number]> = {
  arrowleft: [-1, 0],
  arrowright: [1, 0],
  arrowup: [0, -1],
  arrowdown: [0, 1]
}

export function typing(t: EventTarget | null) {
  return t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
}

/** enter on one selected card: edit a note, open a link or a board */
function enter() {
  const it = app.sel.length === 1 ? getitem(app.sel[0]) : undefined
  if (it?.kind === 'note') app.editing = it.id
  else if (it?.kind === 'link') window.open(it.url, '_blank', 'noopener')
  else if (it?.kind === 'board') openboard(it)
}

/** heights a new card is expected to grow to, for placing it */
const tall = { note: 80, column: 160, board: 220 }

/** a free spot for a new card, at the cursor or else the view center */
export function room(kind: 'note' | 'column' | 'board', from?: { x: number; y: number }) {
  const p = place(widths[kind], tall[kind], from, kind !== 'column')
  return [p, p.t] as const
}

export function onkey(e: KeyboardEvent) {
  if (typing(e.target)) return
  const mod = e.metaKey || e.ctrlKey
  const k = e.key.toLowerCase()
  const one = app.sel.length === 1 ? getitem(app.sel[0]) : undefined
  if (app.menu && k === 'escape') {
    app.menu = null
    return e.preventDefault()
  }
  if (mod && k === 'z') e.shiftKey ? redo() : undo()
  else if (mod && e.shiftKey && k === 'c' && one?.kind === 'link') navigator.clipboard.writeText(one.url ?? '')
  else if (mod && k === 'a') app.sel = items().filter((i) => !i.parent).map((i) => i.id)
  else if (mod && k === 'arrowup') up()
  else if (mod && k === 'd') duplicate(app.sel)
  else if (mod && (k === '=' || k === '+')) step(1)
  else if (mod && k === '-') step(-1)
  else if (mod) return
  else if (e.shiftKey && e.code === 'Digit1') fit()
  else if (e.shiftKey && e.code === 'Digit0') reset()
  else if (k === 'escape') app.sel = []
  else if (k === 'backspace' || k === 'delete') remove(app.sel)
  else if (k === 'e' && one?.kind === 'note') app.editing = one.id
  else if (k === 'm' && app.sel.length) {
    const at = pointer.inside ? pointer : { x: innerWidth / 2 - 116, y: innerHeight / 3 }
    app.menu = { x: at.x, y: at.y, pick: true }
  } else if (k === 'n') addnote(...room('note'))
  else if (k === 'c') addcolumn(room('column')[0])
  else if (k === 'b') addboard(...room('board'))
  else if (k === 'enter') enter()
  else if (arrows[k] && app.sel.length) {
    const d = e.shiftKey ? 10 : 1
    nudge(app.sel, arrows[k][0] * d, arrows[k][1] * d)
  } else return
  e.preventDefault()
}
