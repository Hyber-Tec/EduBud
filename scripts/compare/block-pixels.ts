/**
 * Block by block, how different each block *looks* on the original and on our copy: each block's pixels on both
 * sites, with the section backgrounds hidden on both (the original's are animated, ours still pictures), allowing ours
 * to sit up to 2px off (blocks.ts measures places). A page-wide comparison misses what's inside a block (a font, a
 * color, an underline, where a picture sits in its block); this finds it. Prints the blocks over 1% different and
 * saves each one's original | ours crop in scripts/compare/out/block-pixels/<page>.<width>/.
 *
 * Runs on our computers, like compare.ts, never in CI. Serve the build first, as for blocks.ts. It loads edubud.org
 * once per page: run it on the pages a change touches.
 *
 *   npx tsx scripts/compare/block-pixels.ts --page /our-team --width 1440 [--ours http://127.0.0.1:5179]
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright-core'
import { PNG } from 'pngjs'

const { values: args } = parseArgs({
  options: {
    page: { type: 'string', default: '/' },
    width: { type: 'string', default: '1440' },
    ours: { type: 'string', default: 'http://127.0.0.1:5179' },
  },
})
const width = Number(args.width)
const pagePath = args.page!
const slug = `${pagePath === '/' ? 'home' : pagePath.slice(1).replace(/\//g, '__')}.${width}`
const outDir = path.join(import.meta.dirname, 'out', 'block-pixels', slug)

/** Blocks whose look changes by the moment on both sites (scrolling text, videos, maps, live feeds). */
const SKIP = /marquee|video|map|instagram|scrolling|embed|code/

// Code run in the page is passed as text: tsx's helpers don't exist there. As compare.ts's settle step: every picture
// loaded and decoded, the page scrolled through (what appears on scroll has appeared), animations paused; then the
// backgrounds and their pause buttons hidden.
const SETTLE = `(async () => {
  await document.fonts?.ready
  for (const img of document.querySelectorAll('img[loading="lazy"]')) img.loading = 'eager'
  for (const img of document.images) img.decoding = 'sync'
  await Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 8000) })))
  await Promise.all([...document.images].map((i) => i.decode().catch(() => undefined)))
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  for (let y = 0; y < document.documentElement.scrollHeight; y += Math.round(innerHeight * 0.7)) { window.scrollTo(0, y); await wait(160) }
  window.scrollTo(0, document.documentElement.scrollHeight); await wait(800)
  window.scrollTo(0, 0); await wait(1200)
  await Promise.all([...document.images].map((i) => i.decode().catch(() => undefined)))
  for (const v of document.querySelectorAll('video')) { v.pause(); v.currentTime = 0 }
  const style = document.createElement('style')
  style.textContent = '*,*::before,*::after{animation-play-state:paused!important;transition:none!important;caret-color:transparent!important}' +
    '.section-background,.section-background *,.background-pause-button,.sqs-background-pause-button,[class*="pause-button"]{visibility:hidden!important}'
  for (const el of document.querySelectorAll('*')) {
    if (el.closest('header') || getComputedStyle(el).contentVisibility !== 'auto') continue
    const inside = el.firstElementChild
    if (inside && !inside.checkVisibility({ contentVisibilityAuto: true })) el.style.contentVisibility = 'visible'
  }
  document.head.appendChild(style)
})()`

type Box = { x: number; y: number; w: number; h: number; kind: string; text: string }

const BOXES = (side: 'original' | 'ours') => `(() => {
  const out = {}
  const blocks = ${side === 'original' ? "[...document.querySelectorAll('.fe-block')]" : "[...document.querySelectorAll('.fe-block[data-block]')]"}
  for (const b of blocks) {
    const id = ${side === 'original' ? "[...b.classList].find((c) => c.startsWith('fe-block-'))?.slice(9)" : "b.getAttribute('data-block')"}
    const r = b.getBoundingClientRect()
    const kind = ${side === 'original' ? "(b.querySelector('.sqs-block')?.className.match(/sqs-block-([a-z-]+)/) || [])[1] || ''" : "(b.className.match(/fe-block--([a-z-]+)/) || [])[1] || ''"}
    if (id) out[id] = { x: Math.round(r.x), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height), kind, text: (b.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 40) }
  }
  return out
})()`

async function capture(base: string, side: 'original' | 'ours'): Promise<{ boxes: Record<string, Box>; png: PNG }> {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1, isMobile: width < 768, hasTouch: width < 768 })
  const page = await ctx.newPage()
  await page.goto(base + pagePath, { waitUntil: 'networkidle', timeout: 90_000 }).catch(() => page.waitForTimeout(3000))
  // The original draws its forms after the page has loaded.
  if (side === 'original')
    await page.waitForFunction(`[...document.querySelectorAll('.sqs-block-form')].every((b) => b.querySelector('form'))`, undefined, { timeout: 15_000 }).catch(() => undefined)
  await page.evaluate(SETTLE)
  await page.waitForTimeout(1000)
  const boxes = (await page.evaluate(BOXES(side))) as Record<string, Box>
  const png = PNG.sync.read(await page.screenshot({ fullPage: true }))
  await browser.close()
  return { boxes, png }
}

/** How many pixels differ (by more than 40 in a channel) between the original's block and ours shifted by dx, dy. */
function differing(a: PNG, ra: Box, b: PNG, rb: Box, w: number, h: number, dx: number, dy: number, stopAt: number): number {
  let n = 0
  for (let y = 0; y < h && n < stopAt; y++)
    for (let x = 0; x < w; x++) {
      const xa = ra.x + x, ya = ra.y + y, xb = rb.x + x + dx, yb = rb.y + y + dy
      if (xa < 0 || ya < 0 || xb < 0 || yb < 0 || xa >= a.width || ya >= a.height || xb >= b.width || yb >= b.height) continue
      const ia = (ya * a.width + xa) * 4, ib = (yb * b.width + xb) * 4
      if (Math.max(Math.abs(a.data[ia] - b.data[ib]), Math.abs(a.data[ia + 1] - b.data[ib + 1]), Math.abs(a.data[ia + 2] - b.data[ib + 2])) > 40) n++
    }
  return n
}

async function main() {
  const [a, b] = await Promise.all([capture('https://www.edubud.org', 'original'), capture(args.ours!, 'ours')])
  mkdirSync(outDir, { recursive: true })
  const rows: { id: string; kind: string; pct: number; text: string }[] = []
  for (const [id, ra] of Object.entries(a.boxes)) {
    const rb = b.boxes[id]
    if (!rb || SKIP.test(ra.kind) || SKIP.test(rb.kind)) continue
    const w = Math.min(ra.w, rb.w), h = Math.min(ra.h, rb.h)
    if (w < 4 || h < 4) continue
    // The fewest differing pixels over shifts of ours of up to 2px each way.
    let fewest = Infinity, shift = [0, 0]
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const n = differing(a.png, ra, b.png, rb, w, h, dx, dy, fewest)
        if (n < fewest) [fewest, shift] = [n, [dx, dy]]
      }
    const pct = (100 * fewest) / (w * h)
    rows.push({ id, kind: rb.kind, pct, text: ra.text })
    if (pct <= 1) continue
    // Save original | ours, side by side.
    const crop = new PNG({ width: w * 2 + 6, height: h })
    crop.data.fill(255)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const xa = ra.x + x, ya = ra.y + y, xb = rb.x + x + shift[0], yb = rb.y + y + shift[1]
        if (xa < 0 || ya < 0 || xb < 0 || yb < 0 || xa >= a.png.width || ya >= a.png.height || xb >= b.png.width || yb >= b.png.height) continue
        const ia = (ya * a.png.width + xa) * 4, ib = (yb * b.png.width + xb) * 4
        const o1 = (y * crop.width + x) * 4, o2 = (y * crop.width + w + 6 + x) * 4
        for (let c = 0; c < 4; c++) [crop.data[o1 + c], crop.data[o2 + c]] = [a.png.data[ia + c], b.png.data[ib + c]]
      }
    writeFileSync(path.join(outDir, `${pct.toFixed(1).padStart(5, '0')}-${id}.png`), PNG.sync.write(crop))
  }
  rows.sort((x, y) => y.pct - x.pct)
  const over = rows.filter((r) => r.pct > 1)
  console.log(`${pagePath} at ${width}: ${rows.length} blocks compared, ${over.length} over 1% different (crops in ${path.relative(process.cwd(), outDir)})`)
  for (const r of over) console.log(`  ${r.pct.toFixed(1).padStart(5)}%  ${r.kind.padEnd(10)} ${r.id.slice(0, 26).padEnd(26)} ${r.text}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
