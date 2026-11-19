/**
 * Where each section and block sits on the original and on our copy (our blocks keep the original's ids), and how far
 * apart they are: the quickest way to find a layout that's off. Serve the build first (npm run compare does, or
 * `npx serve -s web/build/client`), or point --ours at a copy.
 *
 *   npx tsx scripts/compare/blocks.ts --page / --width 1440 [--ours http://127.0.0.1:5179] [--min 2]
 */
import { parseArgs } from 'node:util'
import { chromium } from 'playwright-core'

const { values: args } = parseArgs({
  options: {
    page: { type: 'string', default: '/' },
    width: { type: 'string', default: '1440' },
    ours: { type: 'string', default: 'http://127.0.0.1:5179' },
    min: { type: 'string', default: '2' },
  },
})

type Box = { id: string; kind: string; x: number; y: number; w: number; h: number; extra?: string }

const COLLECT = (side: 'original' | 'ours') => `(async () => {
  // No scrolling: the original's header gets shorter once the page has scrolled, which would move everything.
  await new Promise(r => setTimeout(r, 600))
  const out = []
  const rect = (el) => { const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y + window.scrollY), w: Math.round(b.width), h: Math.round(b.height) } }
  const sections = ${side === 'original' ? "[...document.querySelectorAll('section[data-section-id]')]" : "[...document.querySelectorAll('section[data-section]')]"}
  for (const s of sections) out.push({ id: ${side === 'original' ? "s.getAttribute('data-section-id')" : "s.getAttribute('data-section')"}, kind: 'section', ...rect(s) })
  const blocks = ${side === 'original' ? "[...document.querySelectorAll('.fe-block')]" : "[...document.querySelectorAll('.fe-block[data-block]')]"}
  for (const b of blocks) {
    const sec = b.closest('section')
    const secTop = sec ? Math.round(sec.getBoundingClientRect().y + window.scrollY) : 0
    const id = ${side === 'original' ? "[...b.classList].find(c => c.startsWith('fe-block-'))?.slice(9)" : "b.getAttribute('data-block')"}
    const t = b.querySelector('h1, h2, h3, h4, p')
    const cs = t ? getComputedStyle(t) : null
    const r = rect(b)
    out.push({ id, kind: 'block', ...r, y: r.y - secTop, extra: cs ? cs.fontSize + '/' + cs.lineHeight + ' ' + (t.textContent || '').trim().slice(0, 24) : '' })
  }
  return out
})()`

async function collect(url: string, width: number, side: 'original' | 'ours'): Promise<Box[]> {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 768, hasTouch: width < 768 })
  const page = await ctx.newPage()
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 }).catch(() => undefined)
  await page.evaluate('document.fonts.ready')
  // The original draws its forms after the page has loaded (until then, a shorter placeholder): wait for them.
  if (side === 'original')
    await page
      .waitForFunction(`[...document.querySelectorAll('.sqs-block-form')].every((b) => b.querySelector('form'))`, undefined, { timeout: 15_000 })
      .catch(() => console.warn(`  ! ${url}: a form wasn't drawn in time`))
  const boxes = (await page.evaluate(COLLECT(side))) as Box[]
  await browser.close()
  return boxes
}

async function main() {
  const width = Number(args.width)
  const [a, b] = await Promise.all([collect('https://www.edubud.org' + args.page, width, 'original'), collect(args.ours + args.page, width, 'ours')])
  const ours = new Map(b.map((x) => [x.kind + x.id, x]))
  const min = Number(args.min)
  let shown = 0
  for (const o of a) {
    const c = ours.get(o.kind + o.id)
    if (!c) {
      console.log(`MISSING ${o.kind} ${o.id} ${o.extra ?? ''}`)
      continue
    }
    // Sections: their height (a taller section moves everything after it). Blocks: their place within their section.
    const d = o.kind === 'section' ? [0, 0, c.w - o.w, c.h - o.h] : [c.x - o.x, c.y - o.y, c.w - o.w, c.h - o.h]
    if (d.some((v) => Math.abs(v) >= min)) {
      shown++
      console.log(
        `${o.kind.padEnd(7)} ${o.id.slice(0, 12).padEnd(12)} orig ${o.x},${o.y} ${o.w}×${o.h}  ours Δx${d[0]} Δy${d[1]} Δw${d[2]} Δh${d[3]}  | ${o.extra ?? ''} | ${c.extra ?? ''}`,
      )
    }
  }
  console.log(`${shown} of ${a.length} differ by ${min}px or more`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
