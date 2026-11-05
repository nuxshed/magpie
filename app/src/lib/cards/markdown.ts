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

/** render markdown to html: headings, bold, italic, lists, links, inline code */
export function render(md: string) {
  const out: string[] = []
  let para: string[] = []
  let list = ''
  const close = () => {
    if (para.length) out.push(`<p>${para.join('<br>')}</p>`)
    if (list) out.push(`</${list}>`)
    para = []
    list = ''
  }
  const item = (tag: string, text: string) => {
    if (list !== tag) close()
    if (!list) out.push(`<${(list = tag)}>`)
    out.push(`<li>${inline(text)}</li>`)
  }
  for (const line of esc(md).split('\n')) {
    let m
    if ((m = line.match(/^#{1,6}\s+(.*)/))) {
      close()
      out.push(`<h3>${inline(m[1])}</h3>`)
    } else if ((m = line.match(/^\s*[-*]\s+(.*)/))) item('ul', m[1])
    else if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) item('ol', m[1])
    else if (!line.trim()) close()
    else {
      if (list) close()
      para.push(inline(line))
    }
  }
  close()
  return out.join('')
}

/** raw markdown with its symbols wrapped for dimming while editing */
export function highlight(md: string) {
  const mk = (s: string) => `<span class="mk">${s}</span>`
  return esc(md)
    .split('\n')
    .map((line) =>
      line
        .replace(/^(#{1,6}\s|\s*[-*]\s|\s*\d+[.)]\s)/, mk)
        .replace(/\[([^\]]*)\]\(([^)]*)\)/g, (_, t, u) => `${mk('[')}${t}${mk(`](${u})`)}`)
        .replace(/\*\*|\*|`/g, mk)
    )
    .join('\n')
}
