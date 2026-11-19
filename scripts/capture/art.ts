/**
 * The original draws some section backgrounds as animated art in the page (Squarespace's "generative" backgrounds:
 * gradients, conic washes, isometric patterns…). We can't run its code, so we take pictures of the art as the
 * original draws it, at a phone's, a tablet's and a computer's width, with the section's text hidden, and the copy
 * shows the picture that fits the window (web/public/media/art/<section>/<width>.jpg, listed in content/art.json).
 *
 *   npx tsx scripts/capture/art.ts                # every page's art (after npm run capture)
 *   npx tsx scripts/capture/art.ts --only /       # one page's (the footer's comes with the homepage)
 *   npx tsx scripts/capture/art.ts --widths 390   # only the phones' pictures
 */
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright-core'
import { ORIGIN, PAGES } from './capture'

const ROOT = path.resolve(import.meta.dirname, '../..')
const CONTENT = path.join(ROOT, 'web/app/content')
const OUT = path.join(ROOT, 'web/public/media/art')
/** The widths we take, and the widest window each one is shown up to. */
export const ART_WIDTHS = [
  { width: 390, scale: 2, upTo: 767 },
  { width: 1024, scale: 1.5, upTo: 1279 },
  { width: 1920, scale: 1, upTo: undefined },
]

const { values: args } = parseArgs({ options: { only: { type: 'string' }, widths: { type: 'string' } } })

export interface ArtImage {
  src: string
  width: number
  height: number
  upTo?: number
}
type ArtIndex = Record<string, { kind: string; images: ArtImage[] }>

async function sectionsWithArt(pagePath: string): Promise<{ id: string; kind: string }[]> {
  const slug = pagePath === '/' ? 'home' : pagePath.slice(1).replace(/\//g, '__')
  const files = [path.join(CONTENT, 'pages', `${slug}.json`)]
  if (pagePath === '/') files.push(path.join(CONTENT, 'site.json'))
  const out: { id: string; kind: string }[] = []
  for (const f of files) {
    if (!existsSync(f)) continue
    const data = JSON.parse(await readFile(f, 'utf8'))
    for (const s of data.sections ?? data.footer ?? []) {
      const kind = s.background?.art?.kind
      if (kind && kind !== 'none') out.push({ id: s.id, kind })
    }
  }
  return out
}

async function main() {
  const indexFile = path.join(CONTENT, 'art.json')
  const index: ArtIndex = existsSync(indexFile) ? JSON.parse(await readFile(indexFile, 'utf8')) : {}
  const browser = await chromium.launch()
  for (const p of args.only ? [args.only] : PAGES) {
    const sections = await sectionsWithArt(p)
    if (!sections.length) continue
    const widths = args.widths ? ART_WIDTHS.filter((w) => args.widths!.split(',').includes(String(w.width))) : ART_WIDTHS
    for (const { width, scale, upTo } of widths) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: scale, isMobile: width < 768, hasTouch: width < 768 })
      const page = await ctx.newPage()
      await page.goto(ORIGIN + p, { waitUntil: 'networkidle', timeout: 90_000 }).catch(() => undefined)
      // Only the art: no header, text, blocks or pause buttons over it. Everything inside the content is hidden too: the
      // original draws its text highlights (underlines, circles) and its forms' button labels visible on their own,
      // and they'd be left in the picture, out of place wherever the text moves.
      await page.addStyleTag({ content: '#header, .content-wrapper, .content-wrapper *, .background-pause-button, .grecaptcha-badge { visibility: hidden !important; }' })
      for (const { id, kind } of sections) {
        const el = page.locator(`section[data-section-id="${id}"]`).first()
        if (!(await el.count())) {
          console.warn(`  ! ${p}: section ${id} not found`)
          continue
        }
        await el.scrollIntoViewIfNeeded()
        await page.waitForTimeout(1800)
        const box = await el.boundingBox()
        if (!box) continue
        const dir = path.join(OUT, id)
        await mkdir(dir, { recursive: true })
        const file = path.join(dir, `${width}.jpg`)
        await el.screenshot({ path: file, type: 'jpeg', quality: 88 })
        index[id] = index[id] ?? { kind, images: [] }
        index[id].kind = kind
        index[id].images = index[id].images.filter((i) => i.src !== `/media/art/${id}/${width}.jpg`)
        index[id].images.push({ src: `/media/art/${id}/${width}.jpg`, width: Math.round(box.width * scale), height: Math.round(box.height * scale), ...(upTo ? { upTo } : {}) })
        index[id].images.sort((a, b) => (a.upTo ?? 1e9) - (b.upTo ?? 1e9))
      }
      await ctx.close()
      console.log(`${p} @${width}: ${sections.length} sections`)
    }
  }
  await browser.close()
  await writeFile(indexFile, JSON.stringify(index, null, 1) + '\n')
  console.log(`art.json: ${Object.keys(index).length} sections`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
