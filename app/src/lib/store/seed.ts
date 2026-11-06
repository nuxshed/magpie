import { setboards } from '../board.svelte'
import { view } from '../canvas/view.svelte'
import { newid, widths, type board, type draft, type item } from '../model'
import { put } from './db'
import { saveimage } from './images'

let z = 0
const now = Date.now()
const make = (d: draft): item => ({ ...d, id: newid(), z: ++z, updated: now })

/** a flat stand-in photo with its file name, like the mockups */
async function paint(name: string, color: string, w: number, h: number) {
  const c = new OffscreenCanvas(w * 2, h * 2)
  const g = c.getContext('2d')!
  const [r, gr, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16))
  g.fillStyle = color
  g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = r * 0.3 + gr * 0.59 + b * 0.11 > 160 ? 'rgba(0,0,0,.62)' : 'rgba(255,255,255,.92)'
  g.font = '500 21px Geist, system-ui'
  g.fillText(name, 16, c.height - 12)
  return c.convertToBlob()
}

async function img(name: string, color: string, x: number, y: number, w: number, h: number, caption?: string) {
  const { asset, aspect } = await saveimage(await paint(name, color, w, h))
  return make({ kind: 'image', x, y, w, asset, aspect, caption })
}

const note = (x: number, y: number, w: number, text: string) => make({ kind: 'note', x, y, w, text })
const link = (x: number, y: number, w: number, url: string, note?: string) => make({ kind: 'link', x, y, w, url, note })
const board = (x: number, y: number, id: string) => make({ kind: 'board', x, y, w: widths.board, board: id })

/** a column holding cards, in the given order */
function column(x: number, y: number, name: string, list: item[]) {
  const c = make({ kind: 'column', x, y, w: widths.column, name })
  list.forEach((i, order) => Object.assign(i, { parent: c.id, order }))
  return [c, ...list]
}

const sheet = (id: string, name: string, parent: string | undefined, items: item[]): board => ({
  id,
  name,
  parent,
  items,
  updated: now
})

/** three photos for a board's cover, plus a note */
async function cover(names: [string, string][], text: string) {
  const list = []
  for (const [i, [name, color]] of names.entries()) list.push(await img(name, color, 40 + i * 300, 84, 260, 200))
  return [...list, note(40, 340, 256, text)]
}

/** home, a few boards, and the vietnam board from the main mockup, never synced */
export async function seed() {
  localStorage.setItem('seeded', '1')
  const vietnam = sheet('vietnam', 'Vietnam', 'travel', [
    await img('lan-ha-bay.jpg', '#5F7782', 40, 84, 300, 400, 'Lan Hạ side is quieter than Hạ Long proper.'),
    await img('saigon-district-1.gif', '#334055', 40, 540, 300, 200, 'District 1 at 11pm.'),
    await img('sapa-fog.jpg', '#7D8A96', 40, 800, 300, 220),
    note(
      364,
      84,
      256,
      '### Route\n- **17 Dec** Saigon, 4 nights\n- **21 Dec** Đà Nẵng → Hội An\n- **25 Dec** Hải Vân Pass to Huế\n- **27 Dec** night train to Hà Nội\n- **31 Dec** fly home\n\nBook the `SE2` sleeper early, it fills up by mid-Dec.'
    ),
    link(364, 350, 256, 'https://whc.unesco.org/en/list/948'),
    link(364, 628, 256, 'https://www.vietnamcoracle.com/hai-van-pass', 'Hire a driver for the bags, ride light.'),
    ...column(648, 84, 'Hội An', [
      link(0, 0, widths.link, 'https://www.google.com/maps/place/banh-mi-phuong'),
      await img('lanterns-thu-bon.jpg', '#9A5536', 0, 0, 260, 170),
      note(0, 0, widths.note, 'Tailor: **Yaly Couture**. Two fittings, so go on day one.'),
      link(0, 0, widths.link, 'https://www.booking.com/hotel/vn/an-bang-beach-village.html')
    ]),
    ...column(940, 84, 'Hà Nội', [
      link(0, 0, widths.link, 'https://www.airbnb.co.in/experiences/hanoi-street-food', 'Asked about vegetarian stops.'),
      link(0, 0, widths.link, 'https://vnexpress.net/hanoi-train-street'),
      note(0, 0, widths.note, '### Eat\n- Bún chả, **Hương Liên**\n- Egg coffee at *Giảng*, not the copies\n- Phở at Bát Đàn, queue by 7am')
    ]),
    await img('trang-an-boats.jpg', '#5D7458', 648, 556, 272, 180, 'Day trip from Hà Nội? Tràng An boats.'),
    await img('pho-bat-dan.jpg', '#8C6E4C', 648, 800, 272, 180),
    note(940, 684, 272, 'Is Huế → Hà Nội faster by **flight**? Train is 13h but saves a hotel night.'),
    await img('hue-citadel.jpg', '#93737F', 1232, 84, 188, 250, 'Huế, Ngọ Môn gate.'),
    link(1232, 384, 188, 'https://evisa.gov.vn'),
    board(1232, 490, 'food'),
    await img('cafe-giang.jpg', '#5A6947', 1232, 730, 188, 230),
    note(1500, 84, 256, '### Packing\n- Rain jacket, Huế is wet in Dec\n- Layers for Hà Nội, around 15°C\n- Universal adapter'),
    await img('hanoi-night.jpg', '#334055', 1800, 84, 260, 340),
    link(1800, 460, 260, 'https://www.booking.com/hotel/vn/the-myst-dong-khoi.html', '17 to 21 Dec, booked.')
  ])
  const food = sheet(
    'food',
    'Food list',
    'vietnam',
    await cover(
      [
        ['banh-xeo.jpg', '#B0613F'],
        ['ca-phe-sua-da.jpg', '#6E5140'],
        ['bun-bo-hue.jpg', '#A88A62']
      ],
      'Ask the hotel for the **night market** stalls.'
    )
  )
  const travel = sheet('travel', 'Travel', 'home', [
    ...(await cover(
      [
        ['ha-long-mist.jpg', '#5F7782'],
        ['jaipur-gate.jpg', '#A88A62'],
        ['kyoto-garden.jpg', '#4C6350']
      ],
      '### Someday\n- Kyoto in November\n- Jaipur, Hawa Mahal at sunrise'
    )),
    board(340, 340, 'vietnam')
  ])
  const shopping = sheet(
    'shopping',
    'Shopping',
    'home',
    await cover(
      [
        ['ceramic-mug.jpg', '#DCD8D0'],
        ['black-sneakers.jpg', '#2D2D2C'],
        ['linen-shirt.jpg', '#CDBB9C']
      ],
      'Wait for the **December** sale.'
    )
  )
  const room = sheet(
    'room',
    'Room',
    'home',
    await cover(
      [
        ['walnut-desk.jpg', '#6E5140'],
        ['paper-lamp.jpg', '#CDBB9C'],
        ['monstera.jpg', '#5A6947']
      ],
      'Measure the alcove before buying the shelf.'
    )
  )
  const inspiration = sheet(
    'inspiration',
    'Inspiration',
    'home',
    await cover(
      [
        ['pink-facade.jpg', '#93737F'],
        ['blue-hour.jpg', '#334055'],
        ['terracotta.jpg', '#B0613F']
      ],
      'Warm colours, soft light.'
    )
  )
  const home = sheet('home', 'Home', undefined, [
    board(64, 96, 'travel'),
    board(316, 96, 'shopping'),
    board(568, 96, 'room'),
    board(820, 96, 'inspiration'),
    await img('saiho-ji-moss.jpg', '#617055', 1100, 96, 280, 360, 'Saihō-ji, Kyoto. Someday.'),
    note(
      64,
      360,
      268,
      '### Read later\n- *The Timeless Way of Building*\n- Robin Sloan on [home-cooked apps](https://www.robinsloan.com/notes/home-cooked-app/)\n- Ink & Switch, local-first essay'
    ),
    await img('eames-lounge.jpg', '#6E5140', 356, 360, 240, 300),
    await img('fern-shadow.jpg', '#5A6947', 620, 360, 200, 250),
    link(844, 360, 232, 'https://www.are.na/paper-textures'),
    note(844, 456, 232, 'Gift idea: the brass lamp from the shop near **Johari Bazaar**. Ask for the small one.'),
    await img('linen-sofa.jpg', '#CDBB9C', 1100, 500, 280, 190),
    await img('tadao-ando-light.jpg', '#334055', 64, 560, 268, 180)
  ])
  const all = [home, travel, shopping, room, inspiration, vietnam, food]
  setboards(all)
  for (const b of all) put('views', b.id, { x: 0, y: 0, zoom: 1 })
  Object.assign(view, { x: 0, y: 0, zoom: 1 })
}
