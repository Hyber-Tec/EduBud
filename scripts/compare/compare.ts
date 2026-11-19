/**
 * Compares our copy with the original, page by page and width by width: full-page screenshots of both, a map of the
 * pixels that differ, and the share that do. Also the pages' text and links, as lists. Runs on our computers, never in
 * CI (it loads edubud.org). Writes scripts/compare/out/<name>/ with the pictures and report.json, and index.html to
 * look at them side by side.
 *
 *   npm run build && npm run compare                      # every page at every width
 *   npm run compare -- --pages /,/our-team --widths 1440  # some of them
 *   npm run compare -- --ours https://edubud-hybertec.web.app   # against the deployed copy instead of the build
 */
import { createReadStream, existsSync, statSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import { parseArgs } from 'node:util'
import pixelmatch from 'pixelmatch'
import { chromium, type Browser, type Page } from 'playwright-core'
import { PNG } from 'pngjs'

const ROOT = path.resolve(import.meta.dirname, '../..')
const BUILD = path.join(ROOT, 'web/build/client')
const ORIGINAL = 'https://www.edubud.org'

export const ALL_PAGES = [
  '/',
  '/day-learning-program',
  '/summer-program',
  '/community-chapters',
  '/golden-bridge-project',
  '/blue-bridge-project',
  '/california-schools-fire-relief-project',
  '/voices-of-the-vulnerable',
  '/mentors-corner',
  '/our-team',
  '/resources',
  '/support-us',
  '/founder-message',
  '/products-store',
  '/products-store/p/edubud-community-center-tote',
  '/products-store/p/edubud-community-center-cap',
  '/products-store/p/edubud-community-center-hoodie',
  '/products-store/p/the-echo-vase-llhgn',
  '/cart',
  '/search',
  '/search?q=volunteer',
  '/this-page-does-not-exist',
]
export const ALL_WIDTHS = [1920, 1440, 1024, 768, 390]
const HEIGHTS: Record<number, number> = { 1920: 1080, 1440: 900, 1024: 1366, 768: 1024, 390: 844 }

// Not strict: other compare scripts import this file (for serve()), and their own options aren't listed here.
const { values: args } = parseArgs({
  allowPositionals: true,
  strict: false,
  options: {
    pages: { type: 'string' },
    widths: { type: 'string' },
    ours: { type: 'string' },
    name: { type: 'string' },
    port: { type: 'string', default: '5179' },
    fresh: { type: 'boolean' },
  },
}) as { values: { pages?: string; widths?: string; ours?: string; name?: string; port: string; fresh?: boolean } }

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.data': 'text/x-script',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.txt': 'text/plain',
}

/** Serves the build as Firebase Hosting does: `/a` is `a/index.html`, an unknown address the 404 page. */
export function serve(port: number): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0])
    const candidates = [path.join(BUILD, url), path.join(BUILD, url, 'index.html'), path.join(BUILD, url + '.html')]
    const file = candidates.find((f) => f.startsWith(BUILD) && existsSync(f) && statSync(f).isFile())
    if (!file) {
      res.writeHead(404, { 'content-type': MIME['.html'] })
      createReadStream(path.join(BUILD, '404/index.html')).pipe(res)
      return
    }
    const range = req.headers.range
    const size = statSync(file).size
    const type = MIME[path.extname(file)] ?? 'application/octet-stream'
    if (range) {
      const [a, b] = range.replace('bytes=', '').split('-')
      const start = Number(a)
      const end = b ? Number(b) : size - 1
      res.writeHead(206, { 'content-type': type, 'content-range': `bytes ${start}-${end}/${size}`, 'accept-ranges': 'bytes', 'content-length': end - start + 1 })
      createReadStream(file, { start, end }).pipe(res)
      return
    }
    res.writeHead(200, { 'content-type': type, 'content-length': size, 'accept-ranges': 'bytes' })
    createReadStream(file).pipe(res)
  })
  return new Promise((resolve) => server.listen(port, () => resolve(server)))
}

/** Things that move or differ by moment (videos, scrolling text, animated art) are stopped or masked on both sides. */
const MASK_ORIGINAL = ['.sqs-block-marquee', '.grecaptcha-badge']
const MASK_OURS = ['.marquee-block']

async function settle(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 }).catch(() => page.waitForTimeout(3000))
  // Code run in the page is passed as text: tsx's helpers don't exist there.
  await page.evaluate(`(async () => {
    await document.fonts?.ready
    // Load every picture now instead of when it scrolls into view: scrolling would change the original's header.
    for (const img of document.querySelectorAll('img[loading="lazy"]')) img.loading = 'eager'
    // And decode them before painting: a full-page screenshot leaves out pictures decoded "async" below the window.
    for (const img of document.images) img.decoding = 'sync'
    await Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 8000) })))
    // Decode them too: a picture far below the window is otherwise left blank in a full-page screenshot.
    await Promise.all([...document.images].map((i) => i.decode().catch(() => undefined)))
    // Scroll through the page, slowly, as a visitor would, so what shows as it scrolls into view (galleries, blocks
    // that animate in) has shown; then back to the top, where both headers return to their full size (0.3 s).
    const wait = (ms) => new Promise((r) => setTimeout(r, ms))
    for (let y = 0; y < document.documentElement.scrollHeight; y += Math.round(innerHeight * 0.7)) { window.scrollTo(0, y); await wait(160) }
    window.scrollTo(0, document.documentElement.scrollHeight); await wait(800)
    window.scrollTo(0, 0); await wait(1200)
    await Promise.all([...document.images].map((i) => i.decode().catch(() => undefined)))
    for (const v of document.querySelectorAll('video')) { v.pause(); v.currentTime = 0 }
    const style = document.createElement('style')
    style.textContent = '*,*::before,*::after{animation-play-state:paused!important;transition:none!important;caret-color:transparent!important}'
    // The original skips drawing some parts while they're far off screen (content-visibility: auto, its form fields),
    // which a full-page screenshot would leave out: draw those, and only those that are being skipped right now.
    for (const el of document.querySelectorAll('*')) {
      if (el.closest('header') || getComputedStyle(el).contentVisibility !== 'auto') continue
      const inside = el.firstElementChild
      if (inside && !inside.checkVisibility({ contentVisibilityAuto: true })) el.style.contentVisibility = 'visible'
    }
    document.head.appendChild(style)
  })()`)
  await page.waitForTimeout(1200)
}

/** The original's screenshots are kept (out/_original/) and reused: its pages don't change, and loading them less
 * keeps Squarespace from slowing us down. `--fresh` takes them again. */
const ORIGINAL_CACHE = path.join(import.meta.dirname, 'out', '_original')

/** A page's name in the files: `home`, `our-team`, `products-store__p__…`, `search_q_volunteer`. */
function fileName(pagePath: string): string {
  return pagePath === '/' ? 'home' : pagePath.slice(1).replace(/\//g, '__').replace(/[?&=]/g, '_')
}

async function originalShot(browser: Browser, pagePath: string, width: number): Promise<{ png: PNG; text: string[]; links: string[] }> {
  const slug = `${fileName(pagePath)}.${width}`
  const png = path.join(ORIGINAL_CACHE, `${slug}.png`)
  const meta = path.join(ORIGINAL_CACHE, `${slug}.json`)
  if (!args.fresh && existsSync(png) && existsSync(meta)) {
    const { text, links } = JSON.parse(await readFile(meta, 'utf8'))
    return { png: PNG.sync.read(await readFile(png)), text, links }
  }
  const s = await shot(browser, ORIGINAL + pagePath, width, MASK_ORIGINAL)
  await mkdir(ORIGINAL_CACHE, { recursive: true })
  await writeFile(png, PNG.sync.write(s.png))
  await writeFile(meta, JSON.stringify({ text: s.text, links: s.links }))
  return s
}

export async function shot(browser: Browser, url: string, width: number, mask: string[]): Promise<{ png: PNG; text: string[]; links: string[] }> {
  const ctx = await browser.newContext({ viewport: { width, height: HEIGHTS[width] ?? 900 }, deviceScaleFactor: 1, isMobile: width < 768, hasTouch: width < 768 })
  const page = await ctx.newPage()
  // Only GET requests leave: nothing is ever sent to the live site (a form, its analytics).
  await page.route('**/*', (route) => (route.request().method() === 'GET' ? route.continue() : route.abort()))
  await settle(page, url)
  const buf = await page.screenshot({ fullPage: true, mask: mask.map((m) => page.locator(m)), maskColor: '#7f7f7f' })
  const { text, links } = (await page.evaluate(`(() => {
    const text = (document.querySelector('main') ?? document.body).innerText.split('\\n').map((s) => s.trim()).filter(Boolean)
    const links = [...document.querySelectorAll('main a[href], footer a[href]')].map((a) => a.getAttribute('href') ?? '')
    return { text, links }
  })()`)) as { text: string[]; links: string[] }
  await ctx.close()
  return { png: PNG.sync.read(buf), text, links }
}

function pad(png: PNG, width: number, height: number): PNG {
  if (png.width === width && png.height === height) return png
  const out = new PNG({ width, height })
  out.data.fill(255)
  PNG.bitblt(png, out, 0, 0, Math.min(png.width, width), Math.min(png.height, height), 0, 0)
  return out
}

async function main() {
  const pages = args.pages ? args.pages.split(',') : ALL_PAGES
  const widths = args.widths ? args.widths.split(',').map(Number) : ALL_WIDTHS
  const name = args.name ?? new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
  const out = path.join(import.meta.dirname, 'out', name)
  await mkdir(out, { recursive: true })
  const port = Number(args.port)
  const server = args.ours ? null : await serve(port)
  const ours = args.ours ?? `http://127.0.0.1:${port}`
  const browser = await chromium.launch()
  const report: Record<string, unknown>[] = []
  for (const p of pages) {
    for (const w of widths) {
      const slug = `${fileName(p)}.${w}`
      const [a, b] = await Promise.all([originalShot(browser, p, w), shot(browser, ours + p, w, MASK_OURS)])
      const W = Math.max(a.png.width, b.png.width)
      const H = Math.max(a.png.height, b.png.height)
      const pa = pad(a.png, W, H)
      const pb = pad(b.png, W, H)
      const diff = new PNG({ width: W, height: H })
      const bad = pixelmatch(pa.data, pb.data, diff.data, W, H, { threshold: 0.1, includeAA: false, alpha: 0.2 })
      await writeFile(path.join(out, `${slug}.original.png`), PNG.sync.write(pa))
      await writeFile(path.join(out, `${slug}.ours.png`), PNG.sync.write(pb))
      await writeFile(path.join(out, `${slug}.diff.png`), PNG.sync.write(diff))
      const missingText = a.text.filter((t) => !b.text.includes(t))
      const extraText = b.text.filter((t) => !a.text.includes(t))
      const missingLinks = a.links.filter((l) => !b.links.includes(l))
      const row = {
        page: p,
        width: w,
        heights: [a.png.height, b.png.height],
        diffPercent: +((100 * bad) / (W * H)).toFixed(2),
        missingText: missingText.slice(0, 20),
        extraText: extraText.slice(0, 20),
        missingLinks: [...new Set(missingLinks)].slice(0, 20),
      }
      report.push(row)
      console.log(`${p} @${w}: ${row.diffPercent}% differ, heights ${a.png.height} / ${b.png.height}, text −${missingText.length} +${extraText.length}, links −${missingLinks.length}`)
    }
  }
  await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 1))
  await writeFile(path.join(out, 'index.html'), reportHtml(report))
  await browser.close()
  server?.close()
  console.log(`\n${out}/index.html`)
}

function reportHtml(rows: Record<string, unknown>[]): string {
  const cells = rows
    .map((r) => {
      const slug = `${fileName(String(r.page))}.${r.width}`
      return `<section><h2>${r.page} at ${r.width}px: ${r.diffPercent}% of pixels differ</h2>
<div class="row"><figure><img src="${slug}.original.png" loading="lazy"><figcaption>edubud.org</figcaption></figure><figure><img src="${slug}.ours.png" loading="lazy"><figcaption>Our copy</figcaption></figure><figure><img src="${slug}.diff.png" loading="lazy"><figcaption>Differences</figcaption></figure></div>
<pre>${escapeHtml(JSON.stringify({ heights: r.heights, missingText: r.missingText, extraText: r.extraText, missingLinks: r.missingLinks }, null, 1))}</pre></section>`
    })
    .join('\n')
  return `<!doctype html><meta charset="utf-8"><title>Comparison</title><style>body{font:14px system-ui;margin:16px}.row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}img{width:100%;border:1px solid #ccc}figure{margin:0}pre{white-space:pre-wrap;font-size:12px;background:#f6f6f6;padding:8px}</style>${cells}`
}

function escapeHtml(s: string) {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
