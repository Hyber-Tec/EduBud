/**
 * Compares the animated backgrounds (web/app/site/art/) with the original's, pixel for pixel, at the same moments.
 *
 * Both sites run on a fake clock (Playwright's page.clock: Date, performance.now, timers and requestAnimationFrame),
 * paused from the start and moved forward the same way on both, so their frames have the same timestamps. For each
 * page, window width and pixel ratio, it reads what each art section shows (its drawing, from the canvas showing it)
 * on both sites, and counts the pixels that differ:
 *
 * - "first": the first frame, drawn for every section when its art starts, at 16 ms;
 * - then, for each section, scrolled into view: its frames at the given moments (ms) after it starts playing.
 *
 * The original starts each kind's sections as soon as that kind's code arrives, so which sections share a canvas
 * changes from one load to the next. Here it's made to start them in the order ours always takes (kinds in the order
 * they first appear on the page), by holding each kind's code until the kinds before it have started. Kinds left out
 * of --kinds aren't loaded on either site. Bokeh places its discs at random: both sites get the same random numbers
 * (Math.random is replaced by a seeded one, started again when the discs are made).
 *
 * Runs on our computers, never in CI: it loads edubud.org, one page at a time, and refuses every request but GET.
 *
 *   npm run build && npx tsx scripts/compare/art-frames.ts --kinds conic,bokeh
 *   npx tsx scripts/compare/art-frames.ts --pages /,/our-team --widths 1440,390 --scales 1,2 --moments 0,1000,5000,20000
 *   npx tsx scripts/compare/art-frames.ts --pages / --keep         # keep both drawings even when they match
 *   npx tsx scripts/compare/art-frames.ts --same-size              # our art in boxes the size of the original's
 *   npx tsx scripts/compare/art-frames.ts --reduced-motion         # for visitors who ask for less motion
 *   npx tsx scripts/compare/art-frames.ts --resize-to 1024         # also after the window is resized, and back
 *
 * Where our layout makes a section a different size, its art is drawn at that size and can't match; --same-size
 * draws it at the original's, to compare the drawing alone.
 *
 * Writes scripts/compare/out/art-frames/<name>/report.json, and the two drawings and a map of the differing pixels
 * (red) of each comparison that differs.
 */
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { chromium, type Browser, type Page } from 'playwright-core'
import { PNG } from 'pngjs'
import { ALL_PAGES, serve } from './compare'

const ROOT = path.resolve(import.meta.dirname, '../..')
const CONTENT = path.join(ROOT, 'web/app/content')
const ORIGINAL = 'https://www.edubud.org'
const HEIGHTS: Record<number, number> = { 1920: 1080, 1440: 900, 1024: 1366, 768: 1024, 390: 844 }
const T0 = new Date('2026-11-19T12:00:00Z').getTime()

const { values: args } = parseArgs({
  options: {
    pages: { type: 'string' },
    widths: { type: 'string', default: '1440,1024,390' },
    scales: { type: 'string', default: '1' },
    kinds: { type: 'string', default: 'conic,bokeh' },
    sections: { type: 'string' },
    moments: { type: 'string', default: '0,1000,5000,20000' },
    'reduced-motion': { type: 'boolean' },
    'same-size': { type: 'boolean' },
    'resize-to': { type: 'string' },
    keep: { type: 'boolean' },
    ours: { type: 'string' },
    port: { type: 'string', default: '5180' },
    name: { type: 'string', default: 'latest' },
  },
})
const KINDS = args.kinds!.split(',')
const MOMENTS = args.moments!.split(',').map(Number)
const OUT = path.join(ROOT, 'scripts/compare/out/art-frames', args.name!)

interface ArtSection {
  id: string
  kind: string
}

/** A page's art sections in page order (the footer's last), from our content. */
async function artOf(pagePath: string): Promise<ArtSection[]> {
  const slug = pagePath === '/' ? 'home' : pagePath.slice(1).replace(/\//g, '__')
  const page = JSON.parse(await readFile(path.join(CONTENT, 'pages', `${slug}.json`), 'utf8'))
  const site = JSON.parse(await readFile(path.join(CONTENT, 'site.json'), 'utf8'))
  return [...page.sections, ...site.footer]
    .filter((s: any) => s.background?.art?.settings)
    .map((s: any) => ({ id: s.id, kind: s.background.art.settings.type }))
}

/** A seeded Math.random, started again when bokeh makes its discs (its first Float32Array of 100,000 × 3 numbers). */
const SEEDED_RANDOM = `(() => {
  let seed = 1
  Math.random = () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const F32 = Float32Array
  window.Float32Array = new Proxy(F32, { construct(target, a, newTarget) { if (a[0] === 300000) seed = 20261119; return Reflect.construct(target, a, newTarget) } })
})()`

/** Remembers the timestamp of the last animation frame. */
const FRAME_CLOCK = `(() => {
  const raf = window.requestAnimationFrame.bind(window)
  window.__lastFrame = -1
  window.requestAnimationFrame = (cb) => raf((t) => { window.__lastFrame = t; cb(t) })
})()`

/** Reads what a section's art shows: its own canvas, or the shared one moved into it (its top left corner). */
const READ = `((sel) => {
  const node = document.querySelector(sel + ' .section-background-canvas')
  if (!node) return null
  const [own, shared] = node.querySelectorAll('canvas')
  if (!own) return { node: [node.offsetWidth, node.offsetHeight] }
  const showsShared = own.style.display === 'none' && !!shared
  const tmp = document.createElement('canvas')
  tmp.width = own.width
  tmp.height = own.height
  if (own.width && own.height) tmp.getContext('2d').drawImage(showsShared ? shared : own, 0, 0, own.width, own.height, 0, 0, own.width, own.height)
  return {
    png: own.width && own.height ? tmp.toDataURL('image/png') : null,
    node: [node.offsetWidth, node.offsetHeight],
    draw: [own.width, own.height],
    shows: showsShared ? 'shared' : 'own',
    shared: shared ? [shared.width, shared.height, shared.style.width, shared.style.height] : null,
    frame: window.__lastFrame,
  }
})`

/** Which sections share each canvas, in order: the original's (its runtime's own list) or ours (data-stage). */
const STAGES_ORIGINAL = `(() => (window.__sqsWebGL?.controllers ?? []).map((c) => c.content.map((x) => x.node.closest('section').dataset.sectionId)))()`
const STAGES_OURS = `(() => {
  const by = new Map()
  for (const n of document.querySelectorAll('[data-stage]')) {
    const s = n.dataset.stage
    if (!by.has(s)) by.set(s, [])
    by.get(s).push(n.closest('section').dataset.section)
  }
  return [...by.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1])
})()`

interface Side {
  name: 'original' | 'ours'
  page: Page
  select: (id: string) => string
}

async function open(browser: Browser, name: Side['name'], url: string, width: number, scale: number, sections: ArtSection[], css = ''): Promise<Side> {
  const ctx = await browser.newContext({
    viewport: { width, height: HEIGHTS[width] ?? 900 },
    deviceScaleFactor: scale,
    isMobile: width < 768,
    hasTouch: width < 768,
    reducedMotion: args['reduced-motion'] ? 'reduce' : 'no-preference',
  })
  const page = await ctx.newPage()
  const kinds = [...new Set(sections.map((s) => s.kind))]
  const held: { kind: string; release: () => void }[] = []
  await page.route('**/*', async (route) => {
    const req = route.request()
    if (req.method() !== 'GET') return route.abort()
    const file = new URL(req.url()).pathname.split('/').pop() ?? ''
    const kind =
      name === 'original' ? /^background-([a-z]+)\.[0-9a-f]+\.js$/.exec(file)?.[1] : /^([a-z]+)-[\w-]+\.js$/.exec(file)?.[1]
    if (kind && !KINDS.includes(kind) && (name === 'original' || kinds.includes(kind))) return route.abort()
    // The original's kinds wait their turn (see above).
    if (name === 'original' && kind && KINDS.includes(kind)) return new Promise<void>((resolve) => held.push({ kind, release: () => resolve(route.continue()) }))
    if (css && req.resourceType() === 'document' && req.url() === url) {
      const res = await route.fetch()
      return route.fulfill({ response: res, body: (await res.text()).replace('</head>', `<style>${css}</style></head>`) })
    }
    return route.continue()
  })
  await page.clock.install({ time: T0 })
  await page.clock.pauseAt(T0 + 1000)
  await page.addInitScript(FRAME_CLOCK)
  await page.addInitScript(SEEDED_RANDOM)
  // (Not until "load": a held kind's code holds it back.)
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 })

  // Start the kinds in turn, and wait until all their sections have started.
  const started = () => page.evaluate(name === 'original' ? '(window.__sqsWebGL?.contentCount ?? 0)' : `document.querySelectorAll('[data-stage]').length`) as Promise<number>
  let expected = 0
  for (const kind of kinds) {
    expected += sections.filter((s) => s.kind === kind).length
    for (let i = 0; i < 120 && (await started()) < expected; i++) {
      held.filter((h) => h.kind === kind).forEach((h) => h.release())
      await page.waitForTimeout(250)
    }
  }
  if ((await started()) !== sections.length) console.warn(`  ! ${name}: ${await started()} of ${sections.length} sections started`)
  return { name, page, select: (id) => (name === 'original' ? `section[data-section-id="${id}"]` : `section[data-section="${id}"]`) }
}

type Shot = { png?: string | null; node: number[]; draw?: number[]; shows?: string; shared?: unknown[] | null; frame?: number }

function compare(a: Shot, b: Shot) {
  if (!a.png || !b.png) return { comparable: false as const, why: 'nothing drawn' }
  const pa = PNG.sync.read(Buffer.from(a.png.split(',')[1], 'base64'))
  const pb = PNG.sync.read(Buffer.from(b.png.split(',')[1], 'base64'))
  if (pa.width !== pb.width || pa.height !== pb.height) return { comparable: false as const, why: `size ${pa.width}×${pa.height} vs ${pb.width}×${pb.height}` }
  let differ = 0
  let max = 0
  let sum = 0
  const map = new PNG({ width: pa.width, height: pa.height })
  for (let i = 0; i < pa.data.length; i += 4) {
    let d = 0
    for (let c = 0; c < 4; c++) d = Math.max(d, Math.abs(pa.data[i + c] - pb.data[i + c]))
    if (d) differ++
    max = Math.max(max, d)
    sum += d
    const grey = Math.round(pa.data[i] * 0.3 + pa.data[i + 1] * 0.59 + pa.data[i + 2] * 0.11) * 0.3
    map.data[i] = d ? 255 : grey
    map.data[i + 1] = d ? 0 : grey
    map.data[i + 2] = d ? 0 : grey
    map.data[i + 3] = 255
  }
  const pixels = pa.width * pa.height
  return { comparable: true as const, pixels, differ, share: differ / pixels, max, mean: sum / pixels, map, pa, pb, colors: colors(pa) }
}

/** How many different colors a drawing has (up to 10,000): a check that something was drawn. */
function colors(png: PNG): number {
  const seen = new Set<number>()
  for (let i = 0; i < png.data.length && seen.size < 10000; i += 4) seen.add(png.data.readUInt32BE(i))
  return seen.size
}

/** The share of pixels that changed between two drawings of a section (0 to 1): a check that it moves. */
function moved(a: PNG | undefined, b: PNG): number | undefined {
  if (!a || a.width !== b.width || a.height !== b.height) return undefined
  let n = 0
  for (let i = 0; i < a.data.length; i += 4) if (a.data.readUInt32BE(i) !== b.data.readUInt32BE(i)) n++
  return n / (a.width * a.height)
}

async function main() {
  const pagesWithArt: [string, ArtSection[]][] = []
  for (const p of args.pages ? args.pages.split(',') : ALL_PAGES) {
    const all = await artOf(p).catch(() => [])
    const mine = all.filter((s) => KINDS.includes(s.kind))
    if (mine.length) pagesWithArt.push([p, mine])
  }
  let server
  const ours = args.ours ?? `http://127.0.0.1:${args.port}`
  if (!args.ours) {
    if (!existsSync(path.join(ROOT, 'web/build/client'))) throw new Error('Build the website first: npm run build')
    server = await serve(Number(args.port))
  }
  await mkdir(OUT, { recursive: true })
  const browser = await chromium.launch()
  const report: any[] = []
  for (const [pagePath, sections] of pagesWithArt)
    for (const width of args.widths!.split(',').map(Number))
      for (const scale of args.scales!.split(',').map(Number)) {
        const label = `${pagePath} @${width}×${scale}`
        console.log(label, sections.map((s) => `${s.kind}:${s.id.slice(-4)}`).join(' '))
        const original = await open(browser, 'original', ORIGINAL + pagePath, width, scale, sections)
        // With --same-size, our art is drawn in boxes the size of the original's (where our layout differs).
        let css = ''
        if (args['same-size'])
          for (const s of sections) {
            const [w, h] = (await original.page.evaluate(
              `(() => { const n = document.querySelector('${original.select(s.id)} .section-background-canvas'); return [n.offsetWidth, n.offsetHeight] })()`,
            )) as number[]
            css += `section[data-section="${s.id}"] .section-background-canvas { right: auto !important; bottom: auto !important; width: ${w}px !important; height: ${h}px !important; }\n`
          }
        const sides = [original, await open(browser, 'ours', ours + pagePath, width, scale, sections, css)]
        const stages = [await sides[0].page.evaluate(STAGES_ORIGINAL), await sides[1].page.evaluate(STAGES_OURS)]
        const sameStages = JSON.stringify(stages[0]) === JSON.stringify(stages[1])
        if (!sameStages) console.warn(`  ! canvases shared differently: ${JSON.stringify(stages)}`)
        const both = async (fn: (s: Side) => Promise<unknown>) => Promise.all(sides.map(fn))
        const previous = new Map<string, PNG>()
        const look = async (id: string, moment: string) => {
          const [a, b] = (await both((s) => s.page.evaluate(`${READ}(${JSON.stringify(s.select(id))})`))) as Shot[]
          const r = compare(a, b)
          const change = r.comparable ? moved(previous.get(id), r.pa) : undefined
          if (r.comparable) previous.set(id, r.pa)
          const entry = {
            page: pagePath,
            width,
            scale,
            section: id,
            kind: sections.find((s) => s.id === id)!.kind,
            moment,
            frame: [a?.frame, b?.frame],
            node: [a?.node, b?.node],
            draw: [a?.draw, b?.draw],
            shows: [a?.shows, b?.shows],
            ...(r.comparable ? { pixels: r.pixels, differ: r.differ, share: r.share, max: r.max, mean: r.mean, colors: r.colors, moved: change } : { why: r.why }),
          }
          report.push(entry)
          const tag = `${pagePath === '/' ? 'home' : pagePath.slice(1)}-${width}x${scale}-${id.slice(-4)}-${moment}`
          if (r.comparable && (r.differ || args.keep)) {
            await writeFile(path.join(OUT, `${tag}-original.png`), PNG.sync.write(r.pa))
            await writeFile(path.join(OUT, `${tag}-ours.png`), PNG.sync.write(r.pb))
            if (r.differ) await writeFile(path.join(OUT, `${tag}-diff.png`), PNG.sync.write(r.map))
          }
          const what = r.comparable
            ? `${r.differ} of ${r.pixels} px differ (${(r.share * 100).toFixed(3)}%), max ${r.max}; ${r.colors} colors${change === undefined ? '' : `, ${(change * 100).toFixed(1)}% changed since the last`}`
            : `not compared: ${r.why}`
          console.log(`  ${id.slice(-4)} ${moment.padEnd(7)} frame ${a?.frame}/${b?.frame} node ${a?.node}/${b?.node}: ${what}`)
        }
        // The first frame: every section draws once when its art starts.
        await both((s) => s.page.clock.runFor(16))
        for (const s of sections) await look(s.id, 'first')
        // Then each section on screen, at each moment after it starts playing.
        let at = 40000
        // Scrolls a section into view, and waits until the page knows it's on screen (paused art draws once then, on the
        // next frame), and has checked its size: observers made after the art's hear after the art's do. (The page's
        // own timers are stopped with its clock: the wait's limit is ours.)
        const onScreen = (side: Side, id: string) =>
          Promise.race([
            side.page.evaluate(`new Promise((resolve) => {
              const node = document.querySelector(${JSON.stringify(side.select(id))} + ' .section-background-canvas')
              node.closest('section').scrollIntoView({ block: 'start' })
              const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); ro.observe(node) } })
              const ro = new ResizeObserver(() => { ro.disconnect(); resolve(true) })
              io.observe(node)
            })`),
            new Promise((resolve) => setTimeout(() => resolve(false), 5000)),
          ])
        for (const s of sections) {
          if (args.sections && !args.sections.split(',').includes(s.id)) continue
          // The clock jumps first: a jump's own frame can be a millisecond apart on the two pages (each counts from its
          // own start), the frames after it fall on the same 16 ms steps. A paused section draws once, on the first.
          await both((side) => side.page.clock.pauseAt(T0 + at))
          await both((side) => onScreen(side, s.id))
          await both((side) => side.page.waitForTimeout(100))
          for (const m of MOMENTS) {
            if (m) await both((side) => side.page.clock.pauseAt(T0 + at + m))
            await both((side) => side.page.clock.runFor(32))
            await look(s.id, `${m}ms`)
          }
          at += 30000 + Math.max(...MOMENTS)
          // With --resize-to, the window is resized (and back), and the frames after each resize compared.
          if (args['resize-to']) {
            for (const w of [Number(args['resize-to']), width]) {
              await both((side) => side.page.clock.pauseAt(T0 + at))
              await both((side) => side.page.setViewportSize({ width: w, height: HEIGHTS[width] ?? 900 }))
              await both((side) => onScreen(side, s.id))
              await both((side) => side.page.waitForTimeout(500))
              for (const m of [0, 1000]) {
                if (m) await both((side) => side.page.clock.pauseAt(T0 + at + m))
                await both((side) => side.page.clock.runFor(32))
                await look(s.id, `at${w}+${m}`)
              }
              at += 10000
            }
          }
        }
        report.push({ page: pagePath, width, scale, stages, sameStages })
        await Promise.all(sides.map((s) => s.page.context().close()))
        await writeFile(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1))
      }
  await browser.close()
  server?.close()
  const compared = report.filter((r) => r.pixels)
  const exact = compared.filter((r) => r.differ === 0)
  console.log(`\n${compared.length} compared: ${exact.length} identical; max channel difference ${Math.max(0, ...compared.map((r) => r.max))}`)
  console.log(`${report.filter((r) => r.why).length} not compared; report in ${path.relative(ROOT, OUT)}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
