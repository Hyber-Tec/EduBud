/**
 * Checks our pages on phones for what makes them hard to read or use, page by page and width by width:
 *
 *   covered     text with something drawn over it (a picture, a shape, a card, a field, a button…)
 *   cut         text cut off by the box it's in, or by the edge of the screen
 *   spills      text running more than 4px outside its block (into the blocks around it)
 *   over        text running into other text, over a picture, a video, a field, a button or scrolling text, or off
 *               the shapes it's on (partly on, partly off)
 *   split       a word broken across two lines
 *   margin      text closer than 12px to the edge of the screen
 *   tap         buttons, links used as buttons and form controls a finger can't reach 21px from their middle (in
 *               all four directions): smaller than 44 × 44 px, counting padding and areas that answer for them
 *   input       form fields whose text is under 16px (iPhones zoom in when one is tapped)
 *   wide        anything wider than the screen (the page scrolls sideways)
 *   edge        pictures and shapes cut by the edge of the screen (a shape's fill, not its box)
 *   gap         more than 120px of a section with nothing in it
 *   small-text  text under 15.5px, and paragraphs whose lines are closer than 1.3 times their size
 *
 * Runs on our computers, like compare.ts, never in CI. Serve the build first, as for blocks.ts. Pages are checked
 * with reduced motion, so that blocks that animate in are checked in their place.
 *
 *   npm run build && npx tsx scripts/compare/serve.ts 5179 &
 *   npx tsx scripts/compare/phone-check.ts                      # every page at 360, 390 and 430
 *   npx tsx scripts/compare/phone-check.ts --pages /,/our-team --widths 390 --details
 *   npx tsx scripts/compare/phone-check.ts --ours http://127.0.0.1:5183 --json out.json
 */
import { writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { chromium, type Browser } from 'playwright-core'
import { PAGES, SHOP_PATHS } from '../../web/app/content/paths'

/** Every page: the content pages, the shop's, and an address that doesn't exist (the "page not found" page). */
const ALL_PAGES = [...Object.keys(PAGES), ...SHOP_PATHS, '/this-page-does-not-exist']

const { values: args } = parseArgs({
  options: {
    pages: { type: 'string' },
    widths: { type: 'string', default: '360,390,430' },
    ours: { type: 'string', default: 'http://127.0.0.1:5179' },
    json: { type: 'string' },
    details: { type: 'boolean' },
  },
})

/** A phone of each width, at its usual height (the original sizes some text by the window's height). */
const HEIGHTS: Record<number, number> = { 320: 568, 360: 800, 375: 667, 390: 844, 412: 915, 430: 932 }

type Kind = 'covered' | 'cut' | 'spills' | 'over' | 'split' | 'margin' | 'tap' | 'input' | 'wide' | 'edge' | 'gap' | 'small-text'
const KINDS: Kind[] = ['covered', 'cut', 'spills', 'over', 'split', 'margin', 'tap', 'input', 'wide', 'edge', 'gap', 'small-text']

interface Issue {
  kind: Kind
  /** What it is: the text's first words, or the element. */
  what: string
  /** Where: the section and block (their ids), or the element. */
  where: string
  detail: string
}

/** Run in the page (as text: tsx's helpers don't exist there). Returns what it found. */
const CHECK = `(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  await document.fonts?.ready
  for (const img of document.querySelectorAll('img[loading="lazy"]')) img.loading = 'eager'
  await Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 6000) })))
  // Scrolled through once, so what shows as it scrolls into view has shown.
  for (let y = 0; y < document.documentElement.scrollHeight; y += Math.round(innerHeight * 0.8)) { scrollTo(0, y); await wait(50) }
  scrollTo(0, 0)
  await wait(400)
  const still = document.createElement('style')
  still.textContent = '*,*::before,*::after{transition:none!important;animation-play-state:paused!important}'
  document.head.appendChild(still)

  // The screen's width (a page wider than it makes the phone zoom out, and innerWidth grows with it).
  const W = Math.min(innerWidth, document.documentElement.clientWidth)
  const page = (r) => ({ x: r.left, y: r.top + scrollY, w: r.width, h: r.height })
  const label = (el) => (el.innerText || el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || el.tagName).replace(/\\s+/g, ' ').trim().slice(0, 48)
  const where = (el) => {
    const s = el.closest('section')
    const b = el.closest('[data-block]')
    const sid = s?.getAttribute('data-section')
    const parts = []
    if (el.closest('footer')) parts.push('footer')
    if (sid) parts.push('section ' + sid.slice(0, 8))
    if (b) parts.push((b.className.match(/fe-block--(\\w+)/)?.[1] ?? 'block') + ' ' + b.getAttribute('data-block').slice(0, 10))
    if (!parts.length) parts.push(el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : ''))
    return parts.join(' / ')
  }
  const shown = (el) => el.checkVisibility({ opacityProperty: true, visibilityProperty: true })
  const roots = [...document.querySelectorAll('main, footer')]
  const BLOCKISH = /^(block|flex|grid|list-item|table|flow-root|inline-block|inline-flex|-webkit-box)$/
  const holderOf = (el) => { for (let a = el; a; a = a.parentElement) if (BLOCKISH.test(getComputedStyle(a).display)) return a; return el }

  // The page's text, each paragraph (or heading, button, label…) with its letters and its lines.
  const SKIP = '.visually-hidden, script, style, svg, [aria-hidden="true"], .marquee-block, noscript, iframe'
  const groups = new Map()
  for (const root of roots) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let node
    while ((node = walker.nextNode())) {
      const el = node.parentElement
      if (!el || !node.textContent.trim() || el.closest(SKIP) || !shown(el)) continue
      const holder = holderOf(el)
      if (!groups.has(holder)) groups.set(holder, { holder, els: new Set(), letters: [], lines: [] })
      const g = groups.get(holder)
      g.els.add(el)
      const range = document.createRange()
      for (let i = 0; i < node.textContent.length; i++) {
        if (/\\s/.test(node.textContent[i])) continue
        range.setStart(node, i)
        range.setEnd(node, i + 1)
        const r = range.getBoundingClientRect()
        if (r.width > 0.5 && r.height > 0.5) g.letters.push({ ...page(r), fs: parseFloat(getComputedStyle(el).fontSize) })
      }
      range.selectNodeContents(node)
      for (const r of range.getClientRects()) if (r.width > 0.5 && r.height > 0.5) g.lines.push(page(r))
    }
  }
  const texts = [...groups.values()].filter((g) => g.letters.length)

  const issues = []

  // Covered: at a few points in each letter, is something drawn over the text before the text itself is reached?
  // (Every element answers, for once, even those that let the pointer through.)
  const hit = document.createElement('style')
  hit.textContent = 'main *, footer * { pointer-events: auto !important; }'
  document.head.appendChild(hit)
  const paints = (e) => {
    if (/^(IMG|VIDEO|IFRAME|CANVAS|INPUT|TEXTAREA|SELECT)$/.test(e.tagName)) return true
    if (e instanceof SVGGeometryElement) return true
    if (e instanceof SVGElement) return false
    const cs = getComputedStyle(e)
    const a = cs.backgroundColor.match(/[\\d.]+/g)
    if (cs.backgroundImage !== 'none') return true
    return !!a && (a.length < 4 ? true : parseFloat(a[3]) > 0.3)
  }
  const probes = []
  texts.forEach((g, gi) => {
    for (const l of g.letters) for (const fy of [0.3, 0.5, 0.7]) probes.push({ gi, x: l.x + l.w / 2, y: l.y + l.h * fy })
  })
  probes.sort((a, b) => a.y - b.y)
  const covered = new Map()
  const header = document.querySelector('header')
  for (let i = 0; i < probes.length; ) {
    const top = probes[i].y
    scrollTo(0, Math.max(0, top - innerHeight / 2))
    await wait(0)
    const hb = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0
    for (; i < probes.length; i++) {
      const p = probes[i]
      const vy = p.y - scrollY
      if (vy > innerHeight - 2) break
      if (vy < hb + 1 || p.x < 0 || p.x > W) continue
      const g = texts[p.gi]
      const own = g.holder.closest('[data-block]')
      for (const e of document.elementsFromPoint(p.x, vy)) {
        if (header && header.contains(e)) continue
        if (g.holder === e || g.holder.contains(e) || e.contains(g.holder)) break
        // A block's own parts (a player's controls over its picture) are the block's business.
        if (own && own.contains(e)) break
        if (paints(e)) {
          const c = covered.get(p.gi) ?? new Map()
          c.set(e, (c.get(e) ?? 0) + 1)
          covered.set(p.gi, c)
          break
        }
      }
    }
  }
  hit.remove()
  scrollTo(0, 0)
  await wait(50)
  for (const [gi, by] of covered) {
    const g = texts[gi]
    const n = [...by.values()].reduce((a, b) => a + b, 0)
    const share = n / (g.letters.length * 3)
    if (n < 2) continue
    const top = [...by.entries()].sort((a, b) => b[1] - a[1])[0][0]
    const block = top.closest('[data-block]')
    const what = block ? where(block) : top.classList.contains('background-pause-button') ? 'the pause button' : where(top)
    issues.push({ kind: 'covered', what: label(g.holder), where: where(g.holder), detail: Math.round(share * 100) + '% hidden, under ' + what })
  }

  // What text can run over: the drawn part of each block that isn't text.
  const things = []
  const add = (el, kind, r, extra) => { if (r.width > 1 && r.height > 1) things.push({ el, kind, ...page(r), ...extra }) }
  for (const b of document.querySelectorAll('main .fe-block, footer .fe-block')) {
    if (!shown(b)) continue
    const type = b.className.match(/fe-block--(\\w+)/)?.[1]
    if (type === 'image') {
      const frame = b.querySelector('.image-frame')
      const img = b.querySelector('img')
      if (!frame || !img) continue
      const fr = frame.getBoundingClientRect()
      if (getComputedStyle(img).objectFit === 'contain' && img.naturalWidth) {
        const k = Math.min(fr.width / img.naturalWidth, fr.height / img.naturalHeight)
        const w = img.naturalWidth * k, h = img.naturalHeight * k
        add(b, 'picture', new DOMRect(fr.left + (fr.width - w) / 2, fr.top + (fr.height - h) / 2, w, h))
      } else add(b, 'picture', fr)
    } else if (type === 'shape') {
      const rect = b.querySelector('.shape--rect')
      const svg = [...b.querySelectorAll('svg.shape')].find((s) => getComputedStyle(s).display !== 'none')
      if (rect) add(b, 'shape', rect.getBoundingClientRect(), { rect: true })
      else if (svg) {
        let box = null
        for (const geo of svg.querySelectorAll('path, ellipse, circle, rect, polygon')) {
          const r = geo.getBoundingClientRect()
          box = box ? new DOMRect(Math.min(box.left, r.left), Math.min(box.top, r.top), Math.max(box.right, r.right) - Math.min(box.left, r.left), Math.max(box.bottom, r.bottom) - Math.min(box.top, r.top)) : r
        }
        if (box) add(b, 'shape', box, { svg })
      }
    } else if (type === 'button') {
      const a = b.querySelector('.button')
      if (a) add(b, 'button', a.getBoundingClientRect())
    } else if (type === 'video') {
      add(b, 'video', (b.querySelector('.video-frame, .video-player') ?? b).getBoundingClientRect())
    } else if (type === 'form') {
      for (const f of b.querySelectorAll('input:not([type=hidden]), textarea, select, .form-submit')) add(f, 'field', f.getBoundingClientRect())
    } else if (type === 'map' || type === 'snapshot' || type === 'instagram' || type === 'donation' || type === 'marquee') {
      add(b, type === 'marquee' ? 'scrolling text' : type, b.getBoundingClientRect())
    }
  }
  for (const p of document.querySelectorAll('.background-pause-button')) if (shown(p)) add(p, 'pause button', p.getBoundingClientRect())
  /** Is a point of the page inside what a shape fills? */
  const inShape = (th, x, y) => {
    if (th.rect) return x >= th.x && x <= th.x + th.w && y >= th.y && y <= th.y + th.h
    for (const geo of th.svg.querySelectorAll('path, ellipse, circle, rect, polygon')) {
      const m = geo.getScreenCTM()
      if (m && geo.isPointInFill(new DOMPoint(x, y - scrollY).matrixTransform(m.inverse()))) return true
    }
    return false
  }
  const intersect = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
  const POINTS = [[0.02, 0.5], [0.25, 0.5], [0.5, 0.5], [0.75, 0.5], [0.98, 0.5], [0.5, 0.2], [0.5, 0.8]]
  // A line's ink: the middle of its box (a letter's box reaches above and below what it draws).
  const ink = (r) => ({ x: r.x, y: r.y + r.h * 0.2, w: r.w, h: r.h * 0.6 })

  texts.forEach((g, gi) => {
    const el = g.holder
    const block = el.closest('.fe-block')
    const what = label(el)
    const area = g.lines.reduce((s, r) => s + r.w * r.h, 0) || 1
    const shapes = things.filter((th) => th.kind === 'shape' && !(block && th.el === block))
    // Text that sits wholly on a shape is a label on a card: what's under the card isn't under the text.
    const onCard = shapes.some((th) => g.lines.every((r) => POINTS.every(([fx, fy]) => inShape(th, r.x + r.w * fx, r.y + r.h * fy))))
    // Over: text partly on shapes and partly off them crosses their edge (shapes together: a label on one circle
    // that reaches into the next is still on a shape).
    const near = shapes.filter((th) => g.lines.some((r) => intersect(r, th) >= 4))
    if (near.length) {
      let inside = 0, outside = 0
      for (const r of g.lines)
        for (const [fx, fy] of POINTS) {
          if (near.some((th) => inShape(th, r.x + r.w * fx, r.y + r.h * fy))) inside++
          else outside++
        }
      if (inside && outside) issues.push({ kind: 'over', what, where: where(el), detail: 'crosses the edge of ' + near.map((th) => where(th.el).split(' / ').pop()).join(', ') + ' (' + Math.round((100 * inside) / (inside + outside)) + '% on shapes)' })
    }
    // Over: text running over another block's picture, video, field, button or scrolling text.
    for (const th of things) {
      if (th.kind === 'shape' || th.el.contains(el) || el.contains(th.el)) continue
      if (block && th.el.closest('.fe-block') === block) continue
      let over = 0
      for (const r of g.lines) over += intersect(r, th)
      if (over < 4) continue
      if (onCard && th.kind === 'picture') continue
      issues.push({ kind: 'over', what, where: where(el), detail: 'runs over ' + th.kind + ' ' + where(th.el) + ' (' + Math.round((100 * over) / area) + '% of it)' })
    }
    // Over: text running into another block's text (each pair once).
    for (let oi = gi + 1; oi < texts.length; oi++) {
      const o = texts[oi]
      const ob = o.holder.closest('.fe-block')
      if (o.holder.contains(el) || el.contains(o.holder) || (block && ob === block)) continue
      let over = 0
      for (const a of g.lines) for (const b of o.lines) over += intersect(ink(a), ink(b))
      if (over > 6) issues.push({ kind: 'over', what, where: where(el), detail: 'runs into the text "' + label(o.holder).slice(0, 30) + '" (' + where(o.holder) + ')' })
    }
    // Split: a word broken between two of its letters across two lines (a break at a hyphen, a slash or a bracket is
    // the language's own).
    for (const t of g.els) {
      for (const node of t.childNodes) {
        if (node.nodeType !== 3) continue
        const range = document.createRange()
        const text = node.textContent
        const top = (i) => {
          range.setStart(node, i)
          range.setEnd(node, i + 1)
          const r = range.getClientRects()[0]
          return r ? Math.round(r.top) : null
        }
        for (const m of text.matchAll(/[^\\s\\-–—\\/]+/g)) {
          if (m[0].length < 3) continue
          let last = top(m.index)
          for (let i = m.index + 1; i < m.index + m[0].length; i++) {
            const now = top(i)
            if (now !== null && last !== null && now !== last && /[\\p{L}\\p{N}]/u.test(text[i - 1]) && /[\\p{L}\\p{N}]/u.test(text[i])) {
              issues.push({ kind: 'split', what, where: where(el), detail: '"' + m[0] + '" is broken across two lines' })
              break
            }
            if (now !== null) last = now
          }
        }
      }
    }
    // Spills: its lines past its block (across), or its paragraph's box past it (up and down: a letter's own box can
    // reach above and below its line, which isn't spilling).
    if (block) {
      const b = page(block.getBoundingClientRect())
      const h = page(el.getBoundingClientRect())
      // (Letters, not lines: a heading keeps the space at the end of a line, which hangs past it.)
      const across = Math.max(...g.letters.map((r) => Math.max(b.x - r.x, r.x + r.w - (b.x + b.w))))
      const down = Math.max(b.y - h.y, h.y + h.h - (b.y + b.h))
      const out = Math.max(across, down)
      if (out > 4) issues.push({ kind: 'spills', what, where: where(el), detail: Math.round(out) + 'px outside its block' })
    }
    // Cut: by a box that hides what overflows it, or by the edge of the screen. A letter's box reaches a little above
    // and below its ink, so up and down a cut counts from a fifth of its size.
    for (let a = el; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a)
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue
      const r = page(a.getBoundingClientRect())
      let worst = 0
      for (const l of g.letters) {
        const x = cs.overflowX !== 'visible' ? Math.max(r.x - l.x, l.x + l.w - (r.x + r.w)) : 0
        const y = cs.overflowY !== 'visible' ? Math.max(r.y - l.y, l.y + l.h - (r.y + r.h)) - l.fs * 0.2 : 0
        worst = Math.max(worst, x, y)
      }
      if (worst > 1) {
        issues.push({ kind: 'cut', what, where: where(el), detail: Math.round(worst) + 'px cut off by ' + a.tagName.toLowerCase() + '.' + String(a.className).split(' ')[0] })
        break
      }
    }
    const off = Math.max(...g.letters.map((l) => Math.max(-l.x, l.x + l.w - W)))
    if (off > 1) issues.push({ kind: 'cut', what, where: where(el), detail: Math.round(off) + 'px past the edge of the screen' })
    else if (!el.closest('.marquee-block, .rte-scaled-text, .video-block')) {
      const near = Math.min(...g.letters.map((l) => Math.min(l.x, W - (l.x + l.w))))
      if (near < 12) issues.push({ kind: 'margin', what, where: where(el), detail: Math.round(near) + 'px from the edge of the screen' })
    }
  })

  // Tap targets: buttons, links that stand alone (not words in a sentence), form controls.
  const TARGETS = 'a[href], button, input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea, summary, [role=button], label:has(input[type=checkbox]), label:has(input[type=radio])'
  const rectOf = (el) => {
    if (getComputedStyle(el).display !== 'contents') return el.getBoundingClientRect()
    let box = null
    for (const c of el.children) {
      const r = rectOf(c)
      if (r.width && r.height) box = box ? new DOMRect(Math.min(box.left, r.left), Math.min(box.top, r.top), Math.max(box.right, r.right) - Math.min(box.left, r.left), Math.max(box.bottom, r.bottom) - Math.min(box.top, r.top)) : r
    }
    return box ?? new DOMRect()
  }
  const small = []
  for (const root of roots)
    for (const el of root.querySelectorAll(TARGETS)) {
      if (!shown(el) || el.closest('[aria-hidden="true"], .visually-hidden')) continue
      if (el.matches('a')) {
        const holder = el.parentElement.closest('p, li, h1, h2, h3, h4, td, figcaption')
        const own = (el.textContent || '').trim().length
        if (holder && (holder.textContent || '').trim().length > own + 3 && !el.closest('.button-block')) continue
      }
      const r = rectOf(el)
      if (r.width < 1 || r.height < 1) continue
      if (r.width < 44 || r.height < 44) small.push({ el, r: page(r) })
    }
  // A small box can still be a big target (padding drawn outside it, a larger area that answers for it): a finger
  // 21px from its middle, up, down, left and right, must still reach it (two targets 44px apart meet halfway).
  for (const { el, r } of small) {
    const cx = r.x + r.w / 2
    const cy = r.y + r.h / 2
    scrollTo(0, Math.max(0, cy - innerHeight / 2))
    await wait(0)
    const reach = [[-21, 0], [21, 0], [0, -21], [0, 21]].every(([dx, dy]) => {
      const x = cx + dx, y = cy + dy - scrollY
      if (x < 0 || x > W || y < 0 || y > innerHeight) return false
      const hit = document.elementFromPoint(x, y)
      return !!hit && (hit === el || el.contains(hit) || (el.htmlFor && hit.id === el.htmlFor))
    })
    if (!reach) issues.push({ kind: 'tap', what: label(el), where: where(el), detail: Math.round(r.w) + ' × ' + Math.round(r.h) + 'px' })
  }
  scrollTo(0, 0)
  await wait(50)

  // Form fields' text: iPhones zoom into a field whose text is under 16px.
  for (const root of roots)
    for (const el of root.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]), select, textarea')) {
      if (!shown(el)) continue
      const fs = parseFloat(getComputedStyle(el).fontSize)
      if (fs < 16) issues.push({ kind: 'input', what: el.getAttribute('aria-label') || el.id || el.getAttribute('name') || el.tagName.toLowerCase(), where: where(el), detail: fs.toFixed(1) + 'px text' })
    }

  // Wider than the screen: the page, and the outermost things that stick out without being clipped.
  const sw = document.documentElement.scrollWidth
  if (sw > W) {
    issues.push({ kind: 'wide', what: 'the page', where: 'html', detail: 'scrolls sideways: ' + sw + 'px wide on a ' + W + 'px screen' })
    const clippedX = (el) => {
      for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
        if (getComputedStyle(a).overflowX === 'visible') continue
        const r = a.getBoundingClientRect()
        if (r.left >= -1 && r.right <= W + 1) return true
      }
      return false
    }
    const seen = []
    for (const el of document.body.querySelectorAll('*')) {
      if (el.closest('header') || !shown(el) || seen.some((s) => s.contains(el))) continue
      const r = el.getBoundingClientRect()
      if ((r.right > W + 1 || r.left < -1) && r.width > 0 && !clippedX(el)) {
        seen.push(el)
        if (seen.length <= 5) issues.push({ kind: 'wide', what: label(el), where: where(el), detail: 'from ' + Math.round(r.left) + ' to ' + Math.round(r.right) + 'px' })
      }
    }
  }

  // Pictures and shapes cut by the edge of the screen (a shape's own fill, along the edge: its box can be wider).
  for (const th of things) {
    if (th.kind !== 'picture' && th.kind !== 'shape') continue
    const cut = Math.max(-th.x, th.x + th.w - W)
    if (cut <= 4) continue
    if (th.kind === 'shape') {
      let touches = false
      for (let y = th.y; y <= th.y + th.h && !touches; y += 2) touches = inShape(th, 0.5, y) || inShape(th, W - 0.5, y)
      if (!touches) continue
    }
    issues.push({ kind: 'edge', what: th.kind, where: where(th.el), detail: Math.round(cut) + 'px cut off by the edge of the screen' })
  }

  // Empty stretches inside a section, between the top of its first thing and the bottom of its last.
  for (const s of document.querySelectorAll('main section[data-section], footer section[data-section]')) {
    const spans = []
    for (const g of texts) if (s.contains(g.holder)) for (const r of g.lines) spans.push([r.y, r.y + r.h])
    for (const th of things) if (s.contains(th.el) && th.kind !== 'pause button') spans.push([th.y, th.y + th.h])
    for (const el of s.querySelectorAll('img, .accordion, .line-block hr, .gallery-item, .shop-card')) {
      if (!shown(el)) continue
      const r = page(el.getBoundingClientRect())
      if (r.h > 1) spans.push([r.y, r.y + r.h])
    }
    spans.sort((a, b) => a[0] - b[0])
    let end = spans[0]?.[1]
    for (const [a, b] of spans.slice(1)) {
      if (a - end > 120) issues.push({ kind: 'gap', what: 'empty space', where: 'section ' + s.getAttribute('data-section').slice(0, 8), detail: Math.round(a - end) + 'px with nothing in it, at y ' + Math.round(end) })
      end = Math.max(end, b)
    }
  }

  // Paragraphs: their size and line spacing.
  for (const root of roots)
    for (const p of root.querySelectorAll('p, li')) {
      if (!shown(p) || !(p.textContent || '').trim() || p.closest(SKIP + ', .form, .accordion-title, .button')) continue
      const cs = getComputedStyle(p)
      const fs = parseFloat(cs.fontSize)
      const lh = cs.lineHeight === 'normal' ? fs * 1.3 : parseFloat(cs.lineHeight)
      // Line spacing matters once a paragraph has more than one line.
      const lines = Math.round(p.getBoundingClientRect().height / lh)
      if (fs < 15.5 || (lines > 1 && lh / fs < 1.29)) issues.push({ kind: 'small-text', what: label(p), where: where(p), detail: fs.toFixed(1) + 'px, lines ' + (lh / fs).toFixed(2) + '× apart, weight ' + cs.fontWeight })
    }
  // Any other text under 15.5px: labels, captions, prices, a player's time.
  for (const g of texts) {
    if (g.holder.matches('p, li') && !g.holder.closest('.form, .accordion-title, .button')) continue
    const fs = Math.max(...g.letters.map((l) => l.fs))
    if (fs < 15.5) issues.push({ kind: 'small-text', what: label(g.holder), where: where(g.holder), detail: fs.toFixed(1) + 'px' })
  }

  return { issues, height: document.documentElement.scrollHeight }
})()`

async function check(browser: Browser, url: string, width: number): Promise<{ issues: Issue[]; height: number }> {
  const ctx = await browser.newContext({
    viewport: { width, height: HEIGHTS[width] ?? 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  })
  const page = await ctx.newPage()
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 }).catch(() => page.waitForTimeout(3000))
  const result = (await page.evaluate(CHECK)) as { issues: Issue[]; height: number }
  await ctx.close()
  // The same thing found twice (two pieces of one paragraph) is listed once.
  const unique = [...new Map(result.issues.map((i) => [`${i.kind}|${i.what}|${i.where}|${i.detail}`, i])).values()]
  return { issues: unique, height: result.height }
}

async function main() {
  const pages = args.pages ? args.pages.split(',') : ALL_PAGES
  const widths = args.widths!.split(',').map(Number)
  const browser = await chromium.launch()
  const report: { page: string; width: number; height: number; issues: Issue[] }[] = []
  const row = (cells: string[]) => console.log([cells[0].padEnd(46), cells[1].padStart(5), ...cells.slice(2).map((c, i) => c.padStart(Math.max(5, KINDS[i].length)))].join(' '))
  row(['page', 'width', ...KINDS])
  for (const p of pages) {
    for (const w of widths) {
      const { issues, height } = await check(browser, args.ours + p, w)
      report.push({ page: p, width: w, height, issues })
      row([p.slice(0, 46), String(w), ...KINDS.map((k) => String(issues.filter((i) => i.kind === k).length))])
      if (args.details) for (const i of issues) console.log(`    ${i.kind.padEnd(10)} ${i.what.slice(0, 46).padEnd(46)}  ${i.where}: ${i.detail}`)
    }
  }
  row(['total', '', ...KINDS.map((k) => String(report.reduce((s, r) => s + r.issues.filter((i) => i.kind === k).length, 0)))])
  if (args.json) await writeFile(args.json, JSON.stringify(report, null, 1))
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
