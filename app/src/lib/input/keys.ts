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
import { fit, reset, spot, step } from '../canvas/view.svelte'

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

export function onkey(e: KeyboardEvent) {
  if (typing(e.target)) return
  const mod = e.metaKey || e.ctrlKey
  const k = e.key.toLowerCase()
  if (mod && k === 'z') e.shiftKey ? redo() : undo()
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
  else if (k === 'n') addnote(spot())
  else if (k === 'c') addcolumn(spot())
  else if (k === 'b') addboard(spot())
  else if (k === 'enter') enter()
  else if (arrows[k] && app.sel.length) {
    const d = e.shiftKey ? 10 : 1
    nudge(app.sel, arrows[k][0] * d, arrows[k][1] * d)
  } else return
  e.preventDefault()
}
