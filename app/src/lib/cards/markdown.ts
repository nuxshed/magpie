const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** inline marks on already escaped text */
function inline(s: string) {
  const kept: string[] = []
  const keep = (html: string) => `\u0000${kept.push(html) - 1}\u0000`
  return s
    .replace(/`([^`]+)`/g, (_, c) => keep(`<code>${c}</code>`))
    .replace(/\[([^\]]+)\]\(((?:https?:|mailto:)[^)\s]+)\)/g, (_, t, u) =>
      keep(`<a href="${u}" target="_blank" rel="noopener">${t}</a>`)
    )
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*([^*\s][^*]*?)\*/g, '<i>$1</i>')
    .replace(/(^|\W)_([^_\s][^_]*?)_(?=\W|$)/g, '$1<i>$2</i>')
    .replace(/\u0000(\d+)\u0000/g, (_, i) => kept[+i])
}

const task = /^(\s*[-*]\s+\[)([ xX])(\](?:\s|$))/

/** tick or untick the nth checklist item */
export function toggle(md: string, n: number) {
  let k = 0
  return md
    .split('\n')
    .map((line) => line.replace(task, (all, a, c, b) => (k++ === n ? a + (c === ' ' ? 'x' : ' ') + b : all)))
    .join('\n')
}

/** the marker that starts the item after this list line, or null when it is not a list line */
export function nextmarker(line: string) {
  const m = line.match(/^(\s*)([-*]|(\d+)([.)]))(\s+)(\[[ xX]\](?:\s+|$))?/)
  if (!m) return null
  const bullet = m[3] ? `${+m[3] + 1}${m[4]}` : m[2]
  return { marker: m[0], empty: !line.slice(m[0].length).trim(), next: `${m[1]}${bullet}${m[5]}${m[6] ? '[ ] ' : ''}` }
}

/** render markdown to html: headings, bold, italic, lists nested by indent, checklists, links, inline code */
export function render(md: string) {
  const out: string[] = []
  const lists: { tag: string; at: number }[] = []
  let para: string[] = []
  let boxes = 0
  const flush = () => {
    if (para.length) out.push(`<p>${para.join('<br>')}</p>`)
    para = []
  }
  const shut = (at = -1) => {
    while (lists.length && lists[lists.length - 1].at > at) out.push(`</li></${lists.pop()!.tag}>`)
  }
  const item = (tag: string, at: number, text: string) => {
    flush()
    shut(at)
    if (lists.at(-1)?.at === at && lists.at(-1)?.tag !== tag) shut(at - 1)
    if (lists.at(-1)?.at === at) out.push('</li>')
    else {
      out.push(`<${tag}>`)
      lists.push({ tag, at })
    }
    const t = tag === 'ul' && text.match(/^\[([ xX])\](?:\s+(.*))?$/)
    if (!t) return out.push(`<li>${inline(text)}`)
    const on = t[1] !== ' '
    out.push(
      `<li class="task${on ? ' done' : ''}"><span class="box" role="checkbox" aria-checked="${on}" data-n="${boxes++}"></span><span>${inline(t[2] ?? '')}</span>`
    )
  }
  for (const line of esc(md.replace(/^\s*\n|\n\s*$/g, '')).split('\n')) {
    let m
    if ((m = line.match(/^#{1,6}\s+(.*)/))) {
      flush()
      shut()
      out.push(`<h3>${inline(m[1])}</h3>`)
    } else if ((m = line.match(/^(\s*)[-*]\s+(.*)/))) item('ul', m[1].length, m[2])
    else if ((m = line.match(/^(\s*)\d+[.)]\s+(.*)/))) item('ol', m[1].length, m[2])
    else if (!line.trim()) {
      flush()
      shut()
      out.push('<br>')
    } else {
      shut()
      para.push(inline(line))
    }
  }
  flush()
  shut()
  return out.join('')
}

/** raw markdown with its symbols wrapped for dimming while editing */
export function highlight(md: string) {
  const mk = (s: string) => `<span class="mk">${s}</span>`
  return esc(md)
    .split('\n')
    .map((line) =>
      line
        .replace(/^(#{1,6}\s|\s*[-*]\s(?:\[[ xX]\]\s?)?|\s*\d+[.)]\s)/, mk)
        .replace(/\[([^\]]*)\]\(([^)]*)\)/g, (_, t, u) => `${mk('[')}${t}${mk(`](${u})`)}`)
        .replace(/\*\*|\*|`/g, mk)
    )
    .join('\n')
}
