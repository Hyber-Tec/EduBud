/**
 * Reads edubud.org (EduBud's Squarespace site) into our own content files, page by page, and downloads the pictures
 * and videos it uses, at the sizes Squarespace serves them. The copy of the website is drawn from these files
 * (docs/proposals/replica.md). EduBud gave us this site to copy; we take its content and design, never Squarespace's
 * code: the page's HTML is read for its text, pictures, layout numbers and settings, and our components draw them.
 *
 *   npm run capture                     # every page, and the media they use
 *   npm run capture -- --only /our-team # one page (and the header and footer)
 *   npm run capture -- --refresh        # fetch the pages again instead of using scripts/capture/.cache
 *   npm run capture -- --no-media       # content files only
 */
import { parseHTML } from 'linkedom'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { parseCss, walkRules } from './css'
import { downloadMedia, mediaQueue, picture, video } from './media'
import { captureTheme } from './theme'
import type { Area, Block, Grid, Motion, MotionStep, Page, Section, SectionBackground, Theme, Vars } from '../../web/app/content/types'

export const ORIGIN = 'https://www.edubud.org'
const ROOT = path.resolve(import.meta.dirname, '../..')
const CONTENT = path.join(ROOT, 'web/app/content')
const CACHE = path.join(import.meta.dirname, '.cache')
/** The pictures art.ts took of each section's animated art. */
const artIndex: Record<string, { images: { src: string; width: number; height: number; upTo?: number }[] }> = existsSync(path.join(CONTENT, 'art.json'))
  ? JSON.parse(await readFile(path.join(CONTENT, 'art.json'), 'utf8'))
  : {}
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'

/** The pages the copy has: the sitemap's, Founder Message (public, not in the menu), and the shop's. */
export const PAGES = [
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
]

const { values: args } = parseArgs({
  options: { only: { type: 'string' }, refresh: { type: 'boolean' }, 'no-media': { type: 'boolean' } },
})

export async function fetchHtml(pagePath: string): Promise<string> {
  const file = path.join(CACHE, (pagePath === '/' ? 'home' : pagePath.slice(1).replace(/\//g, '__')) + '.html')
  if (!args.refresh && existsSync(file)) return readFile(file, 'utf8')
  const res = await fetch(ORIGIN + pagePath, { headers: { 'user-agent': UA } })
  if (!res.ok) throw new Error(`${pagePath}: HTTP ${res.status}`)
  const html = await res.text()
  await mkdir(CACHE, { recursive: true })
  await writeFile(file, html)
  return html
}

const json = (raw: string | null): any => {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** The original's selectors inside a block, and the element of ours each one styles. */
const BLOCK_PARTS: [RegExp, string][] = [
  [/^\.sqs-html-content$/, ' .rte'],
  [/^\.fluid-image-container(\.visitor-mode)?$/, ' .image-frame'],
  [/^\.intrinsic$/, ' .video-frame'],
  [/^\.accordion-items-container$/, ' .accordion'],
  [/^\.Marquee$/, ' .marquee-block'],
]

/**
 * A block's settings from its own <style> tags: the custom properties it sets (on itself or its parts, which ours
 * inherit), for both widths and for phones, and its other rules (corners, blending, padding) moved to our elements.
 */
function blockVars(styleText: string, blockId: string): { vars: Vars; varsMobile: Vars; rules: { sel: string; decls: [string, string][]; bp: string }[]; css: string } {
  const vars: Vars = {}
  const varsMobile: Vars = {}
  const rules: { sel: string; decls: [string, string][]; bp: string }[] = []
  const css: string[] = []
  const ownId = `#block-${blockId}`
  const ownFe = `.fe-block-${blockId}`
  walkRules(parseCss(styleText), (sel, decls, bp) => {
    rules.push({ sel, decls, bp })
    for (const one of sel.split(',').map((x) => x.trim())) {
      const own = one.startsWith(ownId) ? ownId : one.startsWith(ownFe) ? ownFe : null
      if (!own) continue
      const rest = one.slice(own.length).trim()
      for (const [k, v] of decls) if (k.startsWith('--')) (bp === 'mobile' ? varsMobile : bp === 'all' ? vars : {})[k] = v
      // Where the rule's other declarations go in our markup.
      let target: string | null = null
      if (!rest) target = own === ownFe ? '' : ' > .block'
      else for (const [re, ours] of BLOCK_PARTS) if (re.test(rest)) target = ours
      if (target === null) continue
      const plain = decls.filter(([k]) => !k.startsWith('--') && !['box-sizing', 'height', 'width', 'display'].includes(k))
      if (!plain.length) continue
      const rule = `[data-block="${blockId}"]${target} { ${plain.map(([k, v]) => `${k}: ${v};`).join(' ')} }`
      css.push(bp === 'mobile' ? `@media (max-width: 767px) { ${rule} }` : bp === 'desktop' ? `@media (min-width: 768px) { ${rule} }` : rule)
    }
  })
  return { vars, varsMobile, rules, css: css.join('\n') }
}

/** A palette or custom color from the original's settings, as CSS. */
function colorCss(c: any): string | undefined {
  if (!c) return undefined
  if (c.sitePaletteColor?.colorName) return `hsla(var(--${c.sitePaletteColor.colorName}-hsl), ${c.sitePaletteColor.alphaModifier ?? 1})`
  const h = c.customColor?.hslaValue ?? c.hslaValue
  if (h) return `hsla(${h.hue}, ${(h.saturation * 100).toFixed(1)}%, ${(h.lightness * 100).toFixed(1)}%, ${h.alpha ?? 1})`
  if (typeof c.customColor === 'string') return c.customColor
  return undefined
}

/**
 * Text "highlights" (underlines, markers, circles…) are drawn by the original's script from settings kept beside the
 * text. Each becomes a span with our class and its settings as variables, which blocks.css draws.
 */
function applyTextAttributes(content: Element, scope: Element, blockId: string) {
  const script =
    scope.querySelector('script.TextAttributes-props') ??
    scope.ownerDocument?.querySelector(`script[id="data-context-${blockId}"]`) ??
    scope.closest('section')?.querySelector(`script[id="data-context-${blockId}"]`)
  const raw = script?.textContent
  const attrs: Record<string, any> = {}
  for (const a of json(raw ?? null) ?? []) attrs[a.id] = a
  // A highlight whose settings are missing isn't drawn (as on the original).
  content.querySelectorAll('[data-text-attribute-id]').forEach((span) => {
    const a = attrs[span.getAttribute('data-text-attribute-id') ?? '']
    if (!a) return
    span.setAttribute('class', `rte-highlight rte-highlight--${a.shape ?? 'underline'}`)
    const vars = [`--hl-thickness: ${a.thickness?.value ?? 0.1}${a.thickness?.unit ?? 'em'}`]
    const color = colorCss(a.color)
    if (color) vars.push(`--hl-color: ${color}`)
    span.setAttribute('style', vars.join('; '))
  })
}

/** Text HTML as our components show it: Squarespace's attributes dropped, its text classes renamed `rte-…`. */
export function cleanHtml(el: Element | null | undefined): string {
  if (!el) return ''
  const clone = el.cloneNode(true) as Element
  // An empty paragraph the original keeps ("preserve empty") is a blank line there: give it one here too.
  clone.querySelectorAll('[data-rte-preserve-empty]').forEach((node) => {
    if (!node.textContent?.trim() && !node.querySelector('br, img')) node.innerHTML = '<br>'
  })
  clone.querySelectorAll('*').forEach((node) => {
    for (const attr of [...node.attributes]) {
      if (attr.name.startsWith('data-') || attr.name === 'id') node.removeAttribute(attr.name)
    }
    const cls = node.getAttribute('class')
    if (cls !== null) {
      const next = cls
        .split(/\s+/)
        .filter(Boolean)
        .map((c) => c.replace(/^sqsrte-/, 'rte-'))
        .join(' ')
      if (next) node.setAttribute('class', next)
      else node.removeAttribute('class')
    }
    if (node.tagName === 'A') {
      const href = node.getAttribute('href') ?? ''
      node.setAttribute('href', localHref(href))
    }
  })
  return clone.innerHTML.replace(/\s+\n/g, '\n').trim()
}

/** Links to the original site become links inside the copy. */
export function localHref(href: string): string {
  if (!href) return href
  const m = href.match(/^https?:\/\/(?:www\.)?edubud\.org(\/[^#]*)?(#.*)?$/)
  if (m) return (m[1] || '/') + (m[2] ?? '')
  return href
}

function link(a: Element | null | undefined) {
  if (!a) return undefined
  const href = a.getAttribute('href') ?? ''
  if (!href) return undefined
  return { href: localHref(href), newWindow: a.getAttribute('target') === '_blank' || undefined }
}

const EMPTY_AREA: Area = { rowStart: 1, colStart: 2, rowEnd: 2, colEnd: 3, z: 0 }

/** A section's grid and its blocks' places, from the grid's own <style>. */
function parseGrid(styleText: string, feId: string): { grid: Grid; areas: Record<string, { mobile: Area; desktop: Area }> } {
  const grid: Grid = { mobile: { rows: 1, rowMin: '24px', gap: 0, colGap: 0 }, desktop: { rows: 1, scale: 0.0215, gap: 0, colGap: 0 } }
  const areas: Record<string, { mobile: Area; desktop: Area }> = {}
  const get = (id: string) => (areas[id] ??= { mobile: { ...EMPTY_AREA }, desktop: { ...EMPTY_AREA } })
  walkRules(parseCss(styleText), (sel, decls, bp) => {
    const target = bp === 'desktop' ? 'desktop' : 'mobile'
    if (sel === `.fe-${feId}`) {
      for (const [k, v] of decls) {
        if (k === 'grid-template-rows') {
          const m = v.match(/repeat\(\s*(\d+)\s*,\s*minmax\(\s*([^,]+),/)
          if (m) {
            if (target === 'desktop') grid.desktop.rows = Number(m[1])
            else {
              grid.mobile.rows = Number(m[1])
              grid.mobile.rowMin = m[2].trim()
            }
          }
        } else if (k === 'row-gap' || k === 'column-gap') {
          const g = parseFloat(v)
          const key = k === 'row-gap' ? 'gap' : 'colGap'
          if (target === 'desktop') grid.desktop[key] = g
          else grid.mobile[key] = grid.desktop[key] = g
        } else if (k === '--row-height-scaling-factor') {
          grid.desktop.scale = Number(v)
        }
      }
      return
    }
    const m = sel.match(/^\.fe-block-([\w-]+)(.*)$/)
    if (!m) return
    const [, id, rest] = m
    const area = get(id)[target]
    if (!rest.trim()) {
      for (const [k, v] of decls) {
        if (k === 'grid-area') {
          const [a, b, c, d] = v.split('/').map((x) => Number(x.trim()))
          Object.assign(area, { rowStart: a, colStart: b, rowEnd: c, colEnd: d })
        } else if (k === 'z-index') area.z = Number(v)
      }
    } else if (rest.trim() === '.sqs-block') {
      for (const [k, v] of decls) if (k === 'justify-content') area.justify = v
    } else if (rest.trim() === '.sqs-block-alignment-wrapper') {
      for (const [k, v] of decls) if (k === 'align-items') area.align = v
    }
  })
  // Desktop inherits what it doesn't set (an area is always set for both, alignment sometimes not).
  for (const a of Object.values(areas)) {
    a.desktop.justify ??= a.mobile.justify
    a.desktop.align ??= a.mobile.align
  }
  return { grid, areas }
}

function styleText(el: Element): string {
  return [...el.querySelectorAll('style')].map((s) => s.textContent ?? '').join('\n')
}

/** The rules of a block's style tags that aren't variables, scoped to our block element. */
function scopedCss(rules: { sel: string; decls: [string, string][]; bp: string }[], blockId: string, keep: (sel: string) => string | null): string {
  const out: string[] = []
  for (const r of rules) {
    const sel = keep(r.sel)
    if (!sel) continue
    const decls = r.decls.filter(([k]) => !k.startsWith('--'))
    if (!decls.length) continue
    const body = decls.map(([k, v]) => `${k}: ${v};`).join(' ')
    const rule = `[data-block="${blockId}"]${sel} { ${body} }`
    out.push(r.bp === 'mobile' ? `@media (max-width: 767px) { ${rule} }` : r.bp === 'desktop' ? `@media (min-width: 768px) { ${rule} }` : rule)
  }
  return out.join('\n')
}

interface RawValue {
  value: number
  unit: string
}
interface RawTransform {
  rotation: { z: RawValue }
  scale: { x: RawValue; y: RawValue }
  opacity: RawValue
  offset: { x: RawValue; y: RawValue }
  skew: { x: RawValue; y: RawValue }
}
interface RawAnimation {
  trigger: string
  triggerElement: string
  transforms: RawTransform[]
  ease: string
  bounce?: number
  duration?: RawValue
  delay?: RawValue
  appearPoint?: 'top' | 'middle' | 'bottom'
  threshold?: RawValue | number
  replay?: boolean
}

/**
 * The block's animations ("block animations" on the original, a JSON script in the block): on hover, on press, and
 * once as it scrolls into view. Only what the site uses is read (springs, on the block itself, no fading); anything
 * else is reported so it isn't missed.
 */
function blockMotion(feBlock: Element, id: string): Motion | undefined {
  const script = feBlock.querySelector(`script[data-block-animations="${id}"]`)
  if (!script?.textContent) return undefined
  const data = JSON.parse(script.textContent) as { animations?: RawAnimation[] }
  const motion: Motion = {}
  for (const a of data.animations ?? []) {
    const t = a.transforms[0]
    if (!['hover', 'press', 'appear'].includes(a.trigger) || a.ease !== 'spring' || a.triggerElement !== 'self' || a.transforms.length !== 1 || a.replay || t.opacity.value !== 100) {
      console.warn(`  ! block ${id}: an animation we don't draw (${a.trigger}, ${a.ease}, on ${a.triggerElement})`)
      continue
    }
    const step: MotionStep = {
      pose: {
        x: `${t.offset.x.value}${t.offset.x.unit}`,
        y: `${t.offset.y.value}${t.offset.y.unit}`,
        rotate: t.rotation.z.value,
        scaleX: t.scale.x.value / 100,
        scaleY: t.scale.y.value / 100,
        skewX: t.skew.x.value,
        skewY: t.skew.y.value,
      },
      duration: Math.round((a.duration?.value ?? 0.5) * 1000),
      delay: Math.round((a.delay?.value ?? 0) * 1000),
      bounce: a.bounce ?? 0.5,
    }
    if (a.trigger === 'appear') {
      const threshold = typeof a.threshold === 'number' ? a.threshold : (a.threshold?.value ?? 0)
      motion.appear = { ...step, point: a.appearPoint ?? 'top', threshold }
    } else motion[a.trigger as 'hover' | 'press'] = step
  }
  return Object.keys(motion).length ? motion : undefined
}

function parseBlock(feBlock: Element, areas: Record<string, { mobile: Area; desktop: Area }>): Block | null {
  const id = [...feBlock.classList].find((c) => c.startsWith('fe-block-'))?.slice('fe-block-'.length)
  const sqs = feBlock.querySelector('.sqs-block')
  if (!id || !sqs) return null
  const def = sqs.getAttribute('data-definition-name') ?? ''
  const kind = def.replace('website.components.', '') || (sqs.classList.contains('instagram-block') ? 'instagram' : 'unknown')
  const { vars, varsMobile, rules, css: ownCss } = blockVars(styleText(feBlock), id)
  const area = areas[id] ?? { mobile: { ...EMPTY_AREA }, desktop: { ...EMPTY_AREA } }
  const background = sqs.classList.contains('sqs-background-enabled') || undefined
  const motion = blockMotion(feBlock, id)
  const base = { id, mobile: area.mobile, desktop: area.desktop, vars, varsMobile, css: ownCss || undefined, ...(background ? { background } : {}), ...(motion ? { motion } : {}) }

  switch (kind) {
    case 'html': {
      const content = sqs.querySelector('.sqs-html-content')
      if (content) applyTextAttributes(content, sqs, id)
      return { ...base, type: 'text', html: cleanHtml(content) }
    }

    case 'imageFluid': {
      const img = sqs.querySelector('img[data-src], img')
      const root = sqs.querySelector('.fluid-image-component-root')
      if (!img) return null
      const [w, h] = (img.getAttribute('data-image-dimensions') ?? '0x0').split('x').map(Number)
      const focal = (img.getAttribute('data-image-focal-point') ?? '').split(',').map(Number)
      const pic = picture(img.getAttribute('data-src') ?? img.getAttribute('src') ?? '', {
        width: w,
        height: h,
        alt: img.getAttribute('alt') ?? '',
        focal: focal.length === 2 && focal.every((n) => !Number.isNaN(n)) ? [focal[0], focal[1]] : undefined,
      })
      return {
        ...base,
        type: 'image',
        picture: pic,
        link: link(sqs.querySelector('a[href]')),
        stretched: root?.getAttribute('data-is-image-stretched') === 'true',
        maskSvg: [...sqs.querySelectorAll('svg[data-image-mask-id]')].map((m) => m.outerHTML.replace(/\s+/g, ' ')).join('') || undefined,
      }
    }

    case 'shape': {
      const container = sqs.querySelector('.sqs-shape-block-container-system_desktop') ?? sqs.querySelector('.sqs-shape-block-container')
      const svg = container?.querySelector('svg.sqs-shape') ?? sqs.querySelector('svg.sqs-shape')
      const phoneContainer = sqs.querySelector('.sqs-shape-block-container-system_mobile')
      const phoneSvg = phoneContainer?.querySelector('svg.sqs-shape')
      const phone =
        phoneContainer && phoneSvg
          ? {
              name: phoneContainer.getAttribute('data-shape-name') ?? '',
              svg: phoneSvg.innerHTML.trim(),
              viewBox: phoneSvg.getAttribute('viewBox') ?? '0 0 100 100',
              stretched: phoneContainer.hasAttribute('data-stretched-to-fill'),
            }
          : undefined
      return {
        ...base,
        type: 'shape',
        name: container?.getAttribute('data-shape-name') ?? '',
        svg: svg?.innerHTML.trim() ?? '',
        viewBox: svg?.getAttribute('viewBox') ?? '0 0 100 100',
        stretched: container?.hasAttribute('data-stretched-to-fill') ?? false,
        ...(phone ? { phone } : {}),
        html: cleanHtml(sqs.querySelector('.sqs-html-content')) || undefined,
        link: link(sqs.querySelector('a[href]')),
      }
    }

    case 'button': {
      const c = sqs.querySelector('.sqs-block-button-container')
      const a = sqs.querySelector('a')
      const cls = c?.getAttribute('class') ?? ''
      return {
        ...base,
        type: 'button',
        label: (a?.textContent ?? '').trim(),
        link: link(a),
        kind: (c?.getAttribute('data-button-type') as 'primary') ?? 'primary',
        size: (c?.getAttribute('data-button-size') as 'medium') ?? 'medium',
        alignment: (cls.match(/sqs-block-button-container--(left|center|right)/)?.[1] as 'left') ?? 'center',
        stretched: cls.includes('sqs-stretched'),
      }
    }

    case 'accordion': {
      const ul = sqs.querySelector('.accordion-items-container')
      const items = [...sqs.querySelectorAll('.accordion-item')].map((li) => ({
        title: (li.querySelector('.accordion-item__title')?.textContent ?? '').trim(),
        html: cleanHtml(li.querySelector('.accordion-item__description')),
      }))
      const first = sqs.querySelector('.accordion-item__title-wrapper')
      const desc = sqs.querySelector('.accordion-item__description')
      const textClass = (el: Element | null) =>
        [...(el?.classList ?? [])].filter((c) => c.startsWith('sqsrte-')).map((c) => c.replace('sqsrte-', 'rte-')).join(' ')
      return {
        ...base,
        type: 'accordion',
        items,
        firstOpen: ul?.getAttribute('data-is-expanded-first-item') === 'true',
        allowMultiple: ul?.getAttribute('data-should-allow-multiple-open-items') === 'true',
        dividers: {
          enabled: ul?.getAttribute('data-is-divider-enabled') === 'true',
          first: ul?.getAttribute('data-is-first-divider-visible') === 'true',
          last: ul?.getAttribute('data-is-last-divider-visible') === 'true',
        },
        icon: sqs.querySelector('.accordion-icon-container .plus') ? 'plus' : 'arrow',
        titleTag: (first?.tagName.toLowerCase() as 'p') ?? 'p',
        titleClass: textClass(first),
        descriptionClass: textClass(desc),
        titleAlign: ul?.getAttribute('data-accordion-title-alignment') ?? 'left',
        descriptionAlign: ul?.getAttribute('data-accordion-description-alignment') ?? 'left',
        descriptionPlacement: ul?.getAttribute('data-accordion-description-placement') ?? 'left',
        iconPlacement: (ul?.getAttribute('data-accordion-icon-placement') as 'right') ?? 'right',
      }
    }

    case 'scrolling': {
      const m = sqs.querySelector('.Marquee')
      const items = (json(m?.getAttribute('data-marquee-items') ?? null) ?? []).map((x: { text: string }) => x.text)
      const href = m?.getAttribute('data-link-to')
      return {
        ...base,
        type: 'marquee',
        items,
        textStyle: m?.getAttribute('data-text-style') ?? 'heading-1',
        speed: Number(m?.getAttribute('data-animation-speed') ?? 1),
        direction: (m?.getAttribute('data-animation-direction') as 'left') ?? 'left',
        waveIntensity: Number(m?.getAttribute('data-wave-intensity') ?? 0),
        waveFrequency: Number(m?.getAttribute('data-wave-frequency') ?? 0),
        link: href ? { href: localHref(href), newWindow: m?.getAttribute('data-new-window') === 'true' || undefined } : undefined,
        container: json(m?.getAttribute('data-container-styles') ?? null) ?? {},
      }
    }

    case 'video': {
      const native = sqs.querySelector('.sqs-native-video')
      if (native) {
        const cfg = json(native.getAttribute('data-config-video')) ?? {}
        const [w, h] = String(cfg.systemDataVariants ?? '1920:1080').split(',')[0].split(':').map(Number)
        const file = video(cfg.alexandriaUrl, w, h, true)
        return { ...base, type: 'video', provider: 'native', file, title: '', ratio: (100 * h) / w }
      }
      const wrapper = sqs.querySelector('.sqs-video-wrapper')
      const embed = wrapper?.getAttribute('data-html') ?? ''
      const src = embed.match(/src="([^"]+)"/)?.[1] ?? ''
      const videoId = src.match(/(?:embed\/|v=)([\w-]{11})/)?.[1] ?? ''
      const title = embed.match(/title="([^"]*)"/)?.[1] ?? ''
      const pad = sqs.querySelector('.embed-block-wrapper')?.getAttribute('style') ?? ''
      return {
        ...base,
        type: 'video',
        provider: 'youtube',
        videoId,
        title,
        ratio: parseFloat(pad.match(/padding-bottom:\s*([\d.]+)%/)?.[1] ?? '56.25'),
      }
    }

    case 'horizontalrule':
      return { ...base, type: 'line' }

    case 'form': {
      const raw = sqs.querySelector('script[type="application/json"]')?.textContent ?? ''
      const cfg = json(raw) ?? {}
      delete cfg.formFieldFormats
      delete cfg.secureUrl
      delete cfg.collectionId
      return { ...base, type: 'form', config: cfg }
    }

    case 'map': {
      const cfg = json(sqs.getAttribute('data-block-json')) ?? {}
      const loc = cfg.location ?? {}
      return { ...base, type: 'map', lat: loc.mapLat ?? loc.markerLat ?? 0, lng: loc.mapLng ?? loc.markerLng ?? 0, zoom: loc.mapZoom ?? 13 }
    }

    case 'donation': {
      const raw = sqs.querySelector('script[type="application/json"]')?.textContent ?? ''
      return { ...base, type: 'donation', config: json(raw) ?? { html: cleanHtml(sqs) } }
    }

    case 'instagram':
      return { ...base, type: 'instagram', posts: [], html: '' }

    default:
      console.warn(`  ! block ${id}: unknown kind "${kind}"`)
      return null
  }
}

export function parseSection(sec: Element, doc: Document): Section {
  const id = sec.getAttribute('data-section-id') ?? ''
  const styles = json(sec.getAttribute('data-current-styles')) ?? {}
  const context = json(sec.getAttribute('data-current-context')) ?? {}
  const classes = (sec.getAttribute('class') ?? '')
    .split(/\s+/)
    .filter((c) => /^(section-height--|content-width--|background-width--|vertical-alignment--|horizontal-alignment--)/.test(c))

  const background: SectionBackground = {}
  const mode = styles.backgroundMode as string | undefined
  if (mode === 'image' || (!mode && styles.backgroundImage)) {
    const bi = styles.backgroundImage
    if (bi?.assetUrl) {
      const [w, h] = String(bi.originalSize ?? '0x0').split('x').map(Number)
      const fp = bi.mediaFocalPoint
      background.image = picture(bi.assetUrl, { width: w, height: h, alt: '', focal: fp ? [fp.x, fp.y] : undefined })
    }
  }
  if (mode === 'video') {
    const v = context.video ?? {}
    const item = v.nativeVideoContentItem
    if (item?.alexandriaUrl || item?.structuredContent?.alexandriaUrl) {
      const url = item.alexandriaUrl ?? item.structuredContent.alexandriaUrl
      const [w, h] = String(item.originalSize ?? '1920:1080').split(':').map(Number)
      background.video = { ...video(url, w, h), filter: filterCss(v.filter, v.filterStrength), speed: v.playbackSpeed ?? 1 }
    }
    const bi = styles.backgroundImage
    if (bi?.assetUrl && background.video) {
      const [w, h] = String(bi.originalSize ?? '0x0').split('x').map(Number)
      background.video.poster = picture(bi.assetUrl, { width: w, height: h, alt: '' })
    }
  }
  if (mode === 'generative' || sec.querySelector('.background-fx-canvas')) {
    // Animated art drawn in the page: art.ts takes its pictures (content/art.json); until then, the theme's color.
    const kind = styles.generative?.type ?? context.backgroundMediaEffect?.type ?? 'art'
    const shot = artIndex[id]
    if (kind !== 'none') background.art = { kind, images: shot?.images ?? [] }
  }
  if (typeof styles.imageOverlayOpacity === 'number' && (background.image || background.video)) {
    background.overlayOpacity = styles.imageOverlayOpacity
  }

  // The divider: a clip path the section's border uses.
  let divider: Section['divider']
  const border = sec.querySelector('.section-border')
  const clip = border?.getAttribute('style')?.match(/clip-path:\s*url\(#([^)]+)\)/)?.[1]
  if (clip) {
    const cp = doc.getElementById(clip) ?? sec.querySelector(`[id="${clip}"]`)
    if (cp) divider = { clipPath: cp.outerHTML.replace(/\s+/g, ' ') }
  }

  // The grid and its blocks.
  const fe = sec.querySelector('.fluid-engine')
  const feId = [...(fe?.classList ?? [])].find((c) => /^fe-[0-9a-f]+$/.test(c))?.slice(3) ?? ''
  const gridStyle = [...sec.querySelectorAll('style')].map((s) => s.textContent ?? '').find((t) => t.includes(`.fe-${feId} {`) || t.includes(`.fe-${feId}{`)) ?? ''
  const { grid, areas } = parseGrid(gridStyle, feId)
  const blocks: Block[] = []
  for (const fb of fe ? [...fe.children].filter((c) => c.classList.contains('fe-block')) : []) {
    const b = parseBlock(fb, areas)
    if (b) blocks.push(b)
  }

  const dv = context.divider
  const dividerHeight = dv?.enabled && dv.type !== 'none' ? `${dv.height?.value ?? 0}${dv.height?.unit ?? 'vw'}` : undefined
  if (dividerHeight) classes.push('has-section-divider')
  if (dividerHeight) classes.push(`divider--${dv.type}${dv.isFlipY ? '-flip-y' : ''}${dv.isFlipX ? '-flip-x' : ''}`)
  const vars = { ...(sectionVars(styles) ?? {}), ...(dividerHeight ? { '--divider-height': dividerHeight } : {}) }
  const sqspSection = sec.getAttribute('data-sqsp-section')
  const kind = sqspSection === 'gallery' ? 'gallery' : sqspSection === 'auto-layout' ? 'list' : undefined
  return {
    id,
    ...(kind ? { kind } : {}),
    theme: (sec.getAttribute('data-section-theme') ?? '') as Theme,
    classes,
    background: Object.keys(background).length ? background : undefined,
    divider,
    vars: Object.keys(vars).length ? vars : undefined,
    grid,
    blocks,
  }
}

/** Section settings our CSS reads: a custom height and content width. */
function sectionVars(styles: any): Vars | undefined {
  const v: Vars = {}
  if (styles.sectionHeight === 'section-height--custom') {
    // A custom height N: at least N% of the window's height, and N × 0.1vmax of padding (as measured).
    v['--section-custom-height'] = `${styles.customSectionHeight ?? 0}vh`
    v['--section-custom-pad'] = `${(styles.customSectionHeight ?? 0) * 0.1}vmax`
  }
  if (styles.contentWidth === 'content-width--custom' && styles.customContentWidth) v['--section-custom-width'] = `${styles.customContentWidth}%`
  return Object.keys(v).length ? v : undefined
}

/** Squarespace's video filters, as CSS filters (0 none … the strength is a percent). */
function filterCss(filter: number | undefined, strength: number | undefined): string | undefined {
  const s = (strength ?? 0) / 100
  switch (filter) {
    case 1:
      return `blur(${(s * 20).toFixed(2)}px)`
    case 2:
      return `brightness(${(1 + s).toFixed(2)})`
    case 3:
      return `contrast(${(1 + s).toFixed(2)})`
    case 4:
      return `invert(${s.toFixed(2)})`
    case 5:
      return `saturate(${(1 + s * 3).toFixed(2)})`
    case 6:
      // Seen on the original: filter 6 is the video's opacity over the section's color.
      return `opacity(${s.toFixed(2)})`
    case 7:
      return `grayscale(${s.toFixed(2)})`
    case 8:
      return `hue-rotate(${Math.round(s * 360)}deg)`
    default:
      return undefined
  }
}

function pageMeta(doc: Document) {
  const meta = (sel: string) => doc.querySelector(sel)?.getAttribute('content') ?? ''
  return {
    title: (doc.querySelector('title')?.textContent ?? '').trim(),
    description: meta('meta[name="description"]') || meta('meta[property="og:description"]'),
    image: meta('meta[property="og:image"]') || undefined,
  }
}

export interface NavItem {
  title: string
  href: string
  items?: { title: string; href: string }[]
}

function parseHeader(doc: Document) {
  const header = doc.querySelector('header#header')
  const logoImg = header?.querySelector('.header-title-logo img')
  const logoLink = header?.querySelector('.header-title-logo a')
  const nav: NavItem[] = []
  header?.querySelectorAll('.header-display-desktop .header-nav-list > .header-nav-item').forEach((item) => {
    const folderTitle = item.querySelector('.header-nav-folder-title')
    if (folderTitle) {
      nav.push({
        title: (folderTitle.textContent ?? '').trim(),
        href: localHref(folderTitle.getAttribute('href') ?? ''),
        items: [...item.querySelectorAll('.header-nav-folder-item a')].map((a) => ({
          title: (a.textContent ?? '').trim(),
          href: localHref(a.getAttribute('href') ?? ''),
        })),
      })
    } else {
      const a = item.querySelector('a')
      if (a) nav.push({ title: (a.textContent ?? '').trim(), href: localHref(a.getAttribute('href') ?? '') })
    }
  })
  const [lw, lh] = (logoImg?.getAttribute('data-image-dimensions') ?? '0x0').split('x').map(Number)
  const logoSrc = logoImg?.getAttribute('src') ?? logoImg?.getAttribute('data-src') ?? ''
  return {
    theme: header?.getAttribute('data-section-theme') ?? '',
    logo: logoSrc ? picture(logoSrc, { width: lw, height: lh, alt: logoImg?.getAttribute('alt') ?? '', fixed: true }) : undefined,
    logoHref: localHref(logoLink?.getAttribute('href') ?? '/'),
    nav,
    cartHref: '/cart',
    styleVars: Object.fromEntries(
      (header?.getAttribute('style') ?? '')
        .split(';')
        .map((d) => d.trim())
        .filter((d) => d.startsWith('--'))
        .map((d) => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()]),
    ),
    settings: json(header?.getAttribute('data-current-styles') ?? null),
  }
}

export async function capturePage(pagePath: string): Promise<{ page: Page; doc: Document }> {
  const html = await fetchHtml(pagePath)
  const { document: doc } = parseHTML(html)
  const sections = [...doc.querySelectorAll('main#page section.page-section, main section.page-section')].map((s) => parseSection(s, doc))
  return { page: { path: pagePath, meta: pageMeta(doc), sections }, doc: doc as unknown as Document }
}


/**
 * The fonts: Bricolage Grotesque and DM Sans, both under the SIL Open Font License, which lets anyone serve them. The
 * exact files the original serves (so text measures the same), saved in web/public/fonts/, and their @font-face rules
 * in web/app/site/styles/fonts.css.
 */
async function captureFonts(html: string) {
  const faces = html.match(/@font-face\s*\{[^}]*\}/g) ?? []
  const dir = path.join(ROOT, 'web/public/fonts')
  await mkdir(dir, { recursive: true })
  const rules: string[] = []
  for (const face of faces) {
    const get = (prop: string) => face.match(new RegExp(`${prop}:\\s*([^;}]+)`))?.[1].trim()
    const family = (get('font-family') ?? '').replace(/['"]/g, '')
    const weight = get('font-weight') ?? '400'
    const style = get('font-style') ?? 'normal'
    const range = get('unicode-range')
    const url = face.match(/url\(['"]?([^'")]+)['"]?\)/)?.[1] ?? ''
    const subset = url.match(/\/([\w-]+)\.woff2/)?.[1] ?? 'all'
    const file = `${family.toLowerCase().replace(/\s+/g, '-')}-${weight}-${style}-${subset}.woff2`
    if (!existsSync(path.join(dir, file))) {
      const res = await fetch(url.startsWith('//') ? 'https:' + url : url)
      if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
      await writeFile(path.join(dir, file), Buffer.from(await res.arrayBuffer()))
    }
    rules.push(
      `@font-face {\n  font-family: '${family}';\n  src: url('/fonts/${file}') format('woff2');\n  font-weight: ${weight};\n  font-style: ${style};\n  font-display: swap;${range ? `\n  unicode-range: ${range};` : ''}\n}`,
    )
  }
  const css = `/* The original's fonts, captured by scripts/capture (SIL Open Font License). Don't edit by hand. */\n\n${rules.join('\n\n')}\n`
  await mkdir(path.join(ROOT, 'web/app/site/styles'), { recursive: true })
  await writeFile(path.join(ROOT, 'web/app/site/styles/fonts.css'), css)
  console.log(`fonts: ${rules.length} faces`)
}

async function main() {
  const only = args.only
  const list = only ? [only] : PAGES
  await mkdir(path.join(CONTENT, 'pages'), { recursive: true })

  // The header and footer come from the homepage: they're the same on every page.
  const home = await capturePage('/')
  const homeHtml = await fetchHtml('/')
  await captureFonts(homeHtml)
  const siteCss = homeHtml.match(/href="([^"]*versioned-site-css[^"]*)"/)?.[1]
  if (siteCss) await captureTheme(siteCss.replace(/&amp;/g, '&'), path.join(ROOT, 'web/app/site/styles'))
  const footerSections = [...home.doc.querySelectorAll('footer#footer-sections section.page-section')].map((s) => parseSection(s, home.doc))
  const site = { header: parseHeader(home.doc), footer: footerSections }
  const pages: [string, Page][] = []
  for (const p of list) {
    const { page } = p === '/' ? home : await capturePage(p)
    pages.push([p === '/' ? 'home' : p.slice(1).replace(/\//g, '__'), page])
    const counts: Record<string, number> = {}
    for (const s of page.sections) for (const b of s.blocks) counts[b.type] = (counts[b.type] ?? 0) + 1
    console.log(`${p}: ${page.sections.length} sections ${JSON.stringify(counts)}`)
  }

  const publicDir = path.join(ROOT, 'web/public')
  if (!args['no-media']) await downloadMedia(publicDir)
  else console.log(`media skipped (${mediaQueue.size} assets queued)`)

  // Each picture's format, now that its files exist.
  const withExt = (value: unknown) => JSON.stringify(value, (key, v) => (key === 'ext' && v === '{ext}' ? undefined : v), 1)
  const resolve = (text: string) =>
    text.replace(/"base": "(\/media\/[^"]+)",\n(\s*)"widths"/g, (_m, base: string, indent: string) => {
      const ext = formatOf(path.join(publicDir, base))
      return `"base": "${base}",\n${indent}"ext": "${ext}",\n${indent}"widths"`
    })
  await writeFile(path.join(CONTENT, 'site.json'), resolve(withExt(site)) + '\n')
  console.log(`site.json: ${site.header.nav.length} menu items, ${footerSections.length} footer sections`)
  for (const [slug, page] of pages) await writeFile(path.join(CONTENT, 'pages', `${slug}.json`), resolve(withExt(page)) + '\n')
}

/** The format of a picture folder's files (the server picks it per picture). */
function formatOf(dir: string): string {
  for (const e of ['webp', 'avif', 'jpg', 'png', 'gif', 'svg', 'ico']) if (existsSync(path.join(dir, `100.${e}`)) || existsSync(path.join(dir, `2500.${e}`))) return e
  return 'jpg'
}

void createHash
// Run as a script (npm run capture), not when another capture script imports these functions.
if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
