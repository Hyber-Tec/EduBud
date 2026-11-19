/**
 * Reads the original's gallery sections (pictures in a grid, a sideways reel, justified rows or masonry columns) and
 * its "auto layout" list sections into web/app/content/galleries.json, keyed by section id, and downloads their
 * pictures. The page files (capture.ts) list these sections with their theme and classes; their items are here.
 * As with the rest of the capture, we take EduBud's content and settings from the page, never Squarespace's code.
 *
 *   npx tsx scripts/capture/galleries.ts              # every page's galleries and lists, and their pictures
 *   npx tsx scripts/capture/galleries.ts --no-media   # the content file only
 *   npx tsx scripts/capture/galleries.ts --refresh    # fetch the pages again instead of using scripts/capture/.cache
 */
import { parseHTML } from 'linkedom'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { GalleryDesign, GalleryItem, GallerySectionData, ListSectionData, SectionContent } from '../../web/app/site/sections/types'
import { cleanHtml, fetchHtml, localHref, PAGES } from './capture'
import { downloadMedia, picture } from './media'

const ROOT = path.resolve(import.meta.dirname, '../..')
const OUT = path.join(ROOT, 'web/app/content/galleries.json')
const PUBLIC = path.join(ROOT, 'web/public')
const CACHE = path.join(import.meta.dirname, '.cache')
const refresh = process.argv.includes('--refresh')
const noMedia = process.argv.includes('--no-media')

const json = (raw: string | null | undefined): any => {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** A gallery's design, by the class of its root element. */
const DESIGNS: Record<string, GalleryDesign> = {
  'gallery-grid': 'grid',
  'gallery-reel': 'reel',
  'gallery-strips': 'strips',
  'gallery-masonry': 'masonry',
}

/** The site's own setting for "site default" animations: off unless its global animations are on. */
function siteAnimation(html: string): string {
  const enabled = html.match(/"tweak-global-animations-enabled":"(\w+)"/)?.[1]
  const type = html.match(/"tweak-global-animations-animation-type":"(\w+)"/)?.[1]
  if (enabled !== 'true' || !type || type === 'none') return 'none'
  console.warn(`  ! the site's global animation "${type}" isn't drawn by the copy's galleries; they show pictures without it`)
  return 'none'
}

function galleryItem(fig: Element): GalleryItem | null {
  const img = fig.querySelector('img')
  if (!img) return null
  const url = img.getAttribute('data-src') ?? img.getAttribute('data-image') ?? img.getAttribute('src') ?? ''
  const [width, height] = (img.getAttribute('data-image-dimensions') ?? '0x0').split('x').map(Number)
  const focal = (img.getAttribute('data-image-focal-point') ?? '').split(',').map(Number)
  const caption = fig.querySelector('figcaption, .gallery-caption-content')
  const a = fig.querySelector('a[href]:not([class*="lightbox"])')
  return {
    picture: picture(url, {
      width,
      height,
      alt: img.getAttribute('alt') ?? '',
      focal: focal.length === 2 && focal.every((n) => !Number.isNaN(n)) ? [focal[0], focal[1]] : undefined,
    }),
    ...(img.getAttribute('sizes') ? { sizes: img.getAttribute('sizes')! } : {}),
    ...(caption ? { caption: cleanHtml(caption) } : {}),
    ...(a ? { link: { href: localHref(a.getAttribute('href') ?? ''), newWindow: a.getAttribute('target') === '_blank' || undefined } } : {}),
  }
}

function parseGallery(sec: Element, html: string): GallerySectionData | null {
  const root = [...sec.querySelectorAll('[data-controller]')].find((el) => Object.keys(DESIGNS).some((k) => el.classList.contains(k)))
  const key = root && Object.keys(DESIGNS).find((k) => root.classList.contains(k))
  if (!root || !key) {
    console.warn(`  ! gallery ${sec.getAttribute('data-section-id')}: a design the copy doesn't draw (${sec.querySelector('[data-controller]')?.getAttribute('data-controller')})`)
    return null
  }
  const design = DESIGNS[key]
  const props = json(root.getAttribute('data-props')) ?? {}
  let animation: string = props.scrollAnimation ?? root.getAttribute('data-animation') ?? 'none'
  if (animation === 'site-default') animation = siteAnimation(html)
  const lightbox = design === 'reel' ? sec.querySelector('.gallery-lightbox-outer-wrapper')?.getAttribute('data-lightbox') === 'true' : props.lightboxEnabled === true
  if (lightbox) console.warn(`  ! gallery ${sec.getAttribute('data-section-id')}: its lightbox is on, which the copy doesn't draw yet`)
  const items = [...root.querySelectorAll(`.${key}-item`)].map(galleryItem).filter((x): x is GalleryItem => !!x)
  if (root.getAttribute('data-show-captions') === 'true' || items.some((i) => i.link)) {
    console.warn(`  ! gallery ${sec.getAttribute('data-section-id')}: captions or links on its pictures, which the copy doesn't draw yet`)
  }
  return {
    type: 'gallery',
    design,
    width: props.width ?? root.getAttribute('data-width') ?? 'full',
    animation,
    captions: root.getAttribute('data-show-captions') === 'true',
    lightbox,
    ...(design === 'grid' || design === 'masonry' ? { columns: props.numColumns ?? Number(root.getAttribute('data-columns') ?? 3) } : {}),
    ...(design === 'grid' ? { aspectRatio: props.aspectRatio ?? root.getAttribute('data-aspect-ratio') ?? 'square' } : {}),
    ...(design !== 'reel' ? { gutter: props.gutter ?? 0 } : {}),
    ...(design === 'strips' ? { rowHeight: props.rowHeight ?? 300 } : {}),
    ...(design === 'reel'
      ? { controls: props.controlsLocation ?? root.getAttribute('data-controls-location') ?? 'side', cropping: props.isCropping === true, viewportHeight: props.viewportHeight ?? 75 }
      : {}),
    items,
  }
}

/** The rule of the site's stylesheet that sets a section theme's colors (`:root` for sections without a theme). */
function themeColors(css: string, theme: string): Record<string, string> {
  const selector = theme ? `[data-section-theme="${theme}"]` : ':root'
  let from = 0
  while (true) {
    const i = css.indexOf(selector, from)
    if (i < 0) return {}
    const open = css.indexOf('{', i)
    const close = css.indexOf('}', open)
    const body = css.slice(open + 1, close)
    // The rule must be the theme's own (its selector list ends right before the brace) and define the list's colors.
    if (/^[^{}]*$/.test(css.slice(i, open)) && body.includes('--list-section-banner-slideshow-title-color')) {
      return Object.fromEntries([...body.matchAll(/(--[\w-]+):([^;]+)/g)].map((m) => [m[1], m[2].trim()]))
    }
    from = close
  }
}

const length = (x: { value: number; unit: string } | undefined, fallback = '0px') => (x ? `${x.value}${x.unit}` : fallback)

function parseList(sec: Element, siteCss: string): ListSectionData | null {
  const id = sec.getAttribute('data-section-id')
  const c = sec.querySelector('.user-items-list-item-container')
  const ctx = json(c?.getAttribute('data-current-context'))
  if (!c || !ctx) {
    console.warn(`  ! list ${id}: no items`)
    return null
  }
  if (ctx.layout !== 'banner-slideshow') {
    console.warn(`  ! list ${id}: its layout "${ctx.layout}" isn't drawn by the copy yet`)
    return null
  }
  const o = ctx.options ?? {}
  if (o.isCardEnabled || o.isMediaEnabled || o.isButtonEnabled || ctx.isSectionTitleEnabled || ctx.isSectionButtonEnabled) {
    console.warn(`  ! list ${id}: cards, pictures, buttons or a section title are on; the copy draws titles and text only`)
  }
  const vars = themeColors(siteCss, sec.getAttribute('data-section-theme') ?? '')
  const color = (name: string) => vars[`--list-section-banner-slideshow-${name}`] ?? 'currentColor'
  const custom = o.customOptions ?? {}
  return {
    type: 'list',
    layout: 'banner-slideshow',
    infinite: o.isInfiniteEnabled === true,
    layoutWidth: o.layoutWidth ?? 'full',
    titleAlign: o.titleAlignment ?? 'left',
    bodyAlign: o.bodyAlignment ?? 'left',
    cardVertical: o.cardVerticalPosition ?? 'middle',
    cardHorizontal: o.cardHorizontalPosition ?? 'center',
    paddingTop: length(o.verticalPaddingTop),
    paddingBottom: length(o.verticalPaddingBottom),
    minSlideHeight: length(o.minSlideHeight, 'auto'),
    slidePadding: [length(o.slideContentPaddingTop), length(o.slideContentPaddingRight), length(o.slideContentPaddingBottom), length(o.slideContentPaddingLeft)],
    spaceBetweenSlides: o.spaceBetweenSlides ?? { value: 0, unit: 'px' },
    spaceBelowTitle: length(o.spaceBelowTitle),
    slideContentWidth: length(o.slideContentWidth, '100%'),
    navigation: o.navigationControls ?? 'arrows',
    navigationPlacement: o.navigationPlacement ?? 'bottom',
    navigationAlignment: o.navigationAlignment ?? 'right',
    navigationOffset: length(o.navigationOffset),
    titleSize: custom.customTitleFontSize?.value ?? 2,
    bodySize: custom.customBodyFontSize?.value ?? 1,
    titleTag: (c.querySelector('.list-item-content__title')?.tagName.toLowerCase() ?? 'h2') as ListSectionData['titleTag'],
    colors: {
      title: color('title-color'),
      description: color('description-color'),
      arrow: color('arrow-color'),
      arrowBackground: color('arrow-background-color'),
    },
    items: [...c.querySelectorAll('.list-item')].map((li) => ({
      title: (li.querySelector('.list-item-content__title')?.textContent ?? '').trim(),
      html: cleanHtml(li.querySelector('.list-item-content__description')),
    })),
  }
}

/** The site's stylesheet (its theme colors), cached beside the pages. */
async function siteStylesheet(html: string): Promise<string> {
  const file = path.join(CACHE, 'site.css')
  if (!refresh && existsSync(file)) return readFile(file, 'utf8')
  const href = html.match(/href="([^"]*versioned-site-css[^"]*)"/)?.[1]?.replace(/&amp;/g, '&')
  if (!href) throw new Error("the site's stylesheet isn't linked from the page")
  const res = await fetch(href.startsWith('//') ? 'https:' + href : href)
  if (!res.ok) throw new Error(`${href}: HTTP ${res.status}`)
  const css = await res.text()
  await mkdir(CACHE, { recursive: true })
  await writeFile(file, css)
  return css
}

/** The format a picture's folder holds (Squarespace picks it per picture). */
function formatOf(base: string): string {
  const dir = path.join(PUBLIC, base)
  for (const e of ['webp', 'avif', 'jpg', 'png', 'gif']) if (existsSync(path.join(dir, `100.${e}`)) || existsSync(path.join(dir, `2500.${e}`))) return e
  return 'jpg'
}

async function main() {
  const out: Record<string, SectionContent> = {}
  let siteCss = ''
  for (const pagePath of PAGES) {
    const html = await fetchHtml(pagePath)
    const { document } = parseHTML(html)
    const sections = [...document.querySelectorAll('main section.page-section[data-sqsp-section="gallery"], main section.page-section[data-sqsp-section="auto-layout"]')]
    for (const sec of sections) {
      const id = sec.getAttribute('data-section-id') ?? ''
      if (sec.getAttribute('data-sqsp-section') === 'gallery') {
        const g = parseGallery(sec, html)
        if (g) out[id] = g
        if (g) console.log(`${pagePath}: gallery ${id}, ${g.design}, ${g.items.length} pictures`)
      } else {
        siteCss ||= await siteStylesheet(html)
        const l = parseList(sec, siteCss)
        if (l) out[id] = l
        if (l) console.log(`${pagePath}: list ${id}, ${l.layout}, ${l.items.length} items`)
      }
    }
  }

  if (!noMedia) await downloadMedia(PUBLIC)
  for (const s of Object.values(out)) if (s.type === 'gallery') for (const item of s.items) item.picture.ext = formatOf(item.picture.base)
  await writeFile(OUT, JSON.stringify(out, null, 1) + '\n')
  console.log(`${path.relative(ROOT, OUT)}: ${Object.keys(out).length} sections`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
