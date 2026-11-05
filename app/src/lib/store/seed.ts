import { replace } from '../board.svelte'
import { view } from '../canvas/view.svelte'
import type { draft } from '../model'
import { saveimage } from './images'

type photo = [name: string, color: string, x: number, y: number, w: number, h: number, caption?: string]

const photos: photo[] = [
  ['lan-ha-bay.jpg', '#5F7782', 40, 84, 300, 400, 'Lan Hạ side is quieter than Hạ Long proper.'],
  ['saigon-district-1.gif', '#334055', 40, 540, 300, 200, 'District 1 at 11pm.'],
  ['sapa-fog.jpg', '#7D8A96', 40, 800, 300, 220],
  ['trang-an-boats.jpg', '#5D7458', 648, 556, 272, 180, 'Day trip from Hà Nội? Tràng An boats.'],
  ['pho-bat-dan.jpg', '#8C6E4C', 648, 800, 272, 180],
  ['hue-citadel.jpg', '#93737F', 1232, 84, 188, 250, 'Huế, Ngọ Môn gate.'],
  ['lanterns-thu-bon.jpg', '#9A5536', 1232, 490, 188, 200],
  ['cafe-giang.jpg', '#5A6947', 1232, 730, 188, 230],
  ['hanoi-night.jpg', '#334055', 1800, 84, 260, 340]
]

const notes: [x: number, y: number, w: number, text: string][] = [
  [
    364,
    84,
    256,
    '### Route\n- **17 Dec** Saigon, 4 nights\n- **21 Dec** Đà Nẵng → Hội An\n- **25 Dec** Hải Vân Pass to Huế\n- **27 Dec** night train to Hà Nội\n- **31 Dec** fly home\n\nBook the `SE2` sleeper early, it fills up by mid-Dec.'
  ],
  [648, 84, 272, 'Tailor: **Yaly Couture**. Two fittings, so go on day one.'],
  [940, 84, 272, '### Eat\n- Bún chả, **Hương Liên**\n- Egg coffee at *Giảng*, not the copies\n- Phở at Bát Đàn, queue by 7am'],
  [940, 684, 272, 'Is Huế → Hà Nội faster by **flight**? Train is 13h but saves a hotel night.'],
  [1500, 520, 256, '### Packing\n- Rain jacket, Huế is wet in Dec\n- Layers for Hà Nội, around 15°C\n- Universal adapter']
]

const links: [x: number, y: number, w: number, url: string, note?: string][] = [
  [364, 350, 256, 'https://whc.unesco.org/en/list/948'],
  [364, 628, 256, 'https://www.vietnamcoracle.com/hai-van-pass', 'Hire a driver for the bags, ride light.'],
  [1232, 384, 188, 'https://evisa.gov.vn'],
  [1800, 460, 260, 'https://www.booking.com/hotel/vn/the-myst-dong-khoi.html', '17 to 21 Dec, booked.']
]

/** a flat stand-in photo with its file name, like the mockups */
function paint(name: string, color: string, w: number, h: number) {
  const c = new OffscreenCanvas(w * 2, h * 2)
  const g = c.getContext('2d')!
  g.fillStyle = color
  g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = 'rgba(255,255,255,.92)'
  g.font = '500 21px Geist, system-ui'
  g.fillText(name, 16, c.height - 12)
  return c.convertToBlob()
}

/** fill home with cards like the vietnam mockup */
export async function seed() {
  const list: draft[] = []
  for (const [name, color, x, y, w, h, caption] of photos) {
    const { asset, aspect } = await saveimage(await paint(name, color, w, h))
    list.push({ kind: 'image', x, y, w, asset, aspect, caption })
  }
  for (const [x, y, w, text] of notes) list.push({ kind: 'note', x, y, w, text })
  for (const [x, y, w, url, note] of links) list.push({ kind: 'link', x, y, w, url, note })
  replace(list)
  Object.assign(view, { x: 0, y: 0, zoom: 1 })
}
