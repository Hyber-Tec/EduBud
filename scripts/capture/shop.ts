/**
 * Reads the shop's pages on edubud.org into our content files (web/app/content/shop/): the store page with its product
 * grid and the Fluid Engine sections around it, the four product pages, and the cart's empty state. Downloads their
 * pictures in every width Squarespace serves. Like capture.ts, it takes EduBud's content and settings, never
 * Squarespace's code.
 *
 *   npx tsx scripts/capture/shop.ts              # content, pictures, and the browser pass (cart text, background art)
 *   npx tsx scripts/capture/shop.ts --no-media   # content only (pictures already downloaded keep their format)
 *   npx tsx scripts/capture/shop.ts --refresh    # fetch the pages again instead of using scripts/capture/.cache
 *
 * Buying does nothing on our copy (docs/DECISIONS.md §3): the capture keeps what the pages show (titles, prices as
 * text, pictures), not what a checkout would need.
 */
import { parseHTML } from 'linkedom'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright-core'
import type { PageMeta, Picture, Theme } from '../../web/app/content/types'
import type { CartPage, Product, ProductCard, ProductList, StorePage, StoreSection, Vars } from '../../web/app/content/shop/types'
import { cleanHtml, fetchHtml, localHref, ORIGIN, parseSection } from './capture'
import { downloadMedia, mediaQueue, picture } from './media'

const ROOT = path.resolve(import.meta.dirname, '../..')
const OUT = path.join(ROOT, 'web/app/content/shop')
const PUBLIC = path.join(ROOT, 'web/public')
const CACHE = path.join(import.meta.dirname, '.cache')

/** The store page, and the products it lists (the tee keeps its odd address, `the-echo-vase-llhgn`). */
const STORE = '/products-store'
const CART = '/cart'

// Options capture.ts knows too: it reads the command line as well when it's imported.
const { values: args } = parseArgs({ options: { refresh: { type: 'boolean' }, 'no-media': { type: 'boolean' } } })

const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()

/** The CSS custom properties an element's `style` attribute sets. */
function styleVars(el: Element | null | undefined): Vars {
  const vars: Vars = {}
  for (const decl of (el?.getAttribute('style') ?? '').split(';')) {
    const i = decl.indexOf(':')
    const name = decl.slice(0, i).trim()
    const value = decl.slice(i + 1).trim()
    if (name.startsWith('--') && value) vars[name] = value
  }
  return vars
}

function pageMeta(doc: Document): PageMeta {
  const meta = (sel: string) => doc.querySelector(sel)?.getAttribute('content') ?? ''
  return {
    title: text(doc.querySelector('title')),
    description: meta('meta[name="description"]') || meta('meta[property="og:description"]'),
  }
}

/** A Squarespace picture (`<img data-src data-image-dimensions data-image-focal-point alt>`), registered to download. */
function imgPicture(img: Element): Picture {
  const [width, height] = (img.getAttribute('data-image-dimensions') ?? '0x0').split('x').map(Number)
  const focal = (img.getAttribute('data-image-focal-point') ?? '').split(',').map(Number)
  return picture(img.getAttribute('data-src') ?? img.getAttribute('src') ?? '', {
    width,
    height,
    alt: img.getAttribute('alt') ?? '',
    focal: focal.length === 2 && focal.every((n) => !Number.isNaN(n)) ? [focal[0], focal[1]] : undefined,
  })
}

function parseProductList(sec: Element): ProductList {
  const list = sec.querySelector('.product-list')
  const layout = sec.querySelector('.product-list-layout-container')
  const items: ProductCard[] = [...sec.querySelectorAll('.product-list-item')].map((item) => {
    const link = item.querySelector('a.product-list-item-link')
    const cover = item.querySelector('img.grid-image-cover')
    const hover = item.querySelector('.has-hover-img img.grid-image-hover')
    if (!link || !cover) throw new Error('a product in the grid has no link or picture')
    return {
      title: text(item.querySelector('.product-list-item-title')),
      href: localHref(link.getAttribute('href') ?? ''),
      price: text(item.querySelector('.product-list-item-price')),
      picture: imgPicture(cover),
      hoverPicture: hover ? imgPicture(hover) : undefined,
      button: text(item.querySelector('.add-to-cart-text')),
    }
  })
  const context = JSON.parse(list?.getAttribute('data-context') ?? '{}')
  return {
    id: sec.getAttribute('data-section-id') ?? '',
    theme: (sec.getAttribute('data-section-theme') ?? '') as Theme,
    title: context.collectionTitle ?? text(sec.querySelector('.nested-category-title')),
    vars: styleVars(layout),
    items,
  }
}

async function captureStore(): Promise<StorePage> {
  const { document: doc } = parseHTML(await fetchHtml(STORE))
  const sections: StoreSection[] = [...doc.querySelectorAll('main#page section.page-section')].map((sec) =>
    sec.getAttribute('data-sqsp-section') === 'product-list'
      ? { kind: 'products', list: parseProductList(sec) }
      : { kind: 'section', section: parseSection(sec, doc as unknown as Document) },
  )
  return { path: STORE, meta: pageMeta(doc as unknown as Document), sections }
}

async function captureProduct(pagePath: string): Promise<Product> {
  const { document: doc } = parseHTML(await fetchHtml(pagePath))
  const sec = doc.querySelector('section.product-detail-section')
  const layout = sec?.querySelector('[data-product-detail-layout]')
  if (!sec || !layout) throw new Error(`${pagePath}: no product on the page`)
  const description = sec.querySelector('.product-description.hidden-down-md') ?? sec.querySelector('.product-description')
  return {
    path: pagePath,
    meta: pageMeta(doc as unknown as Document),
    theme: (sec.getAttribute('data-section-theme') ?? '') as Theme,
    breadcrumb: [...sec.querySelectorAll('.product-nav a')].map((a) => ({ title: text(a), href: localHref(a.getAttribute('href') ?? '') })),
    title: text(sec.querySelector('.product-title')),
    price: text(sec.querySelector('.product-price-value') ?? sec.querySelector('.product-price')),
    description: cleanHtml(description),
    pictures: [...sec.querySelectorAll('img.product-gallery-slides-item-image')].map(imgPicture),
    button: text(sec.querySelector('.product-add-to-cart .add-to-cart-text')),
    vars: styleVars(layout),
  }
}

type CartText = Pick<CartPage, 'title' | 'emptyMessage' | 'button'>

/** A JPEG's size, from its header (the art pictures are JPEGs the browser pass saved). */
async function jpegSize(file: string): Promise<{ width: number; height: number }> {
  const buf = await readFile(file)
  for (let i = 2; i < buf.length - 9; ) {
    const marker = buf[i + 1]
    if (marker >= 0xc0 && marker <= 0xc3) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) }
    i += 2 + buf.readUInt16BE(i + 2)
  }
  throw new Error(`${file}: not a JPEG`)
}

/**
 * What only a browser shows: the cart's text (Squarespace draws the cart in the page), and a still of the animated art
 * some sections draw as their background, at a computer's and a phone's width. Cached: it runs again only with
 * --refresh or when a file is missing.
 */
async function browserPass(store: StorePage): Promise<CartText> {
  const cartFile = path.join(CACHE, 'cart-text.json')
  const artSections = store.sections.flatMap((s) => (s.kind === 'section' && s.section.background?.art ? [s.section] : []))
  const views = [
    { kind: 'desktop', width: 1920, height: 1080 },
    { kind: 'mobile', width: 390, height: 844 },
  ] as const
  const artFile = (id: string, kind: string, width: number) => path.join(PUBLIC, `media/art-${id}-${kind}`, `${width}.jpg`)
  const missing = artSections.some((s) => views.some((v) => !existsSync(artFile(s.id, v.kind, v.width))))
  const browser = args.refresh || missing || !existsSync(cartFile) ? await chromium.launch() : null
  try {
    if (browser && (args.refresh || !existsSync(cartFile))) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
      await page.goto(ORIGIN + CART, { waitUntil: 'networkidle', timeout: 90_000 }).catch(() => undefined)
      await page.waitForSelector('.cart-title', { timeout: 30_000 })
      const cart = (await page.evaluate(`(() => {
        const a = document.querySelector('.cart-continue-button')
        return {
          title: document.querySelector('.cart-title').textContent.trim(),
          emptyMessage: document.querySelector('.empty-message').textContent.trim(),
          button: { label: a.textContent.trim(), href: a.getAttribute('href') },
        }
      })()`)) as CartText
      await page.close()
      await mkdir(CACHE, { recursive: true })
      await writeFile(cartFile, JSON.stringify(cart, null, 1))
    }
    for (const section of artSections) {
      for (const view of views) {
        const file = artFile(section.id, view.kind, view.width)
        if (browser && (args.refresh || !existsSync(file))) {
          const mobile = view.kind === 'mobile'
          const page = await browser.newPage({ viewport: { width: view.width, height: view.height }, isMobile: mobile, hasTouch: mobile })
          await page.goto(ORIGIN + STORE, { waitUntil: 'networkidle', timeout: 90_000 }).catch(() => undefined)
          const sel = `section[data-section-id="${section.id}"]`
          await page.waitForSelector(`${sel} .background-fx-canvas`, { timeout: 30_000 })
          await page.locator(sel).scrollIntoViewIfNeeded()
          await page.waitForTimeout(2500)
          // Only the art: the section's content, its pause button and the header are hidden for the picture (with
          // opacity: some of the form's parts set their own visibility).
          await page.addStyleTag({ content: `${sel} .content-wrapper, ${sel} .background-pause-button, #header { opacity: 0 !important }` })
          await page.waitForTimeout(300)
          await mkdir(path.dirname(file), { recursive: true })
          await page.locator(`${sel} .section-background`).screenshot({ path: file, type: 'jpeg', quality: 92 })
          await page.close()
        }
        const { width, height } = await jpegSize(file)
        const still: Picture = { base: `/media/art-${section.id}-${view.kind}`, ext: 'jpg', widths: [view.width], width, height, alt: '' }
        section.background!.art = { ...section.background!.art!, [view.kind]: still }
      }
    }
  } finally {
    await browser?.close()
  }
  return JSON.parse(await readFile(cartFile, 'utf8'))
}

/** The format of a picture folder's files, once downloaded (Squarespace picks it per picture). */
function formatOf(dir: string): string {
  for (const e of ['webp', 'avif', 'jpg', 'png', 'gif']) if (existsSync(path.join(dir, `100.${e}`)) || existsSync(path.join(dir, `2500.${e}`))) return e
  return 'jpg'
}

/** Every picture's `ext`, now that its files exist. */
function resolveFormats(value: unknown): void {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) return value.forEach(resolveFormats)
  const obj = value as Record<string, unknown>
  if (typeof obj.base === 'string' && obj.ext === '{ext}') obj.ext = formatOf(path.join(PUBLIC, obj.base))
  for (const v of Object.values(obj)) resolveFormats(v)
}

async function write(file: string, value: unknown) {
  resolveFormats(value)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(value, null, 1) + '\n')
}

async function main() {
  const store = await captureStore()
  const list = store.sections.find((s) => s.kind === 'products')
  if (!list || list.kind !== 'products') throw new Error(`${STORE}: no product grid`)
  const products: Product[] = []
  for (const item of list.list.items) products.push(await captureProduct(item.href))

  const { document: cartDoc } = parseHTML(await fetchHtml(CART))
  const cart = await browserPass(store)
  // The cart has no section of its own: it takes the site's colors, the white theme's.
  const cartPage: CartPage = { path: CART, meta: pageMeta(cartDoc as unknown as Document), theme: 'white', ...cart }

  if (!args['no-media']) await downloadMedia(PUBLIC)
  else console.log(`media skipped (${mediaQueue.size} pictures queued)`)

  await write(path.join(OUT, 'store.json'), store)
  for (const p of products) await write(path.join(OUT, 'products', `${p.path.split('/').pop()}.json`), p)
  await write(path.join(OUT, 'cart.json'), cartPage)
  const counts = store.sections.map((s) => (s.kind === 'products' ? `grid of ${s.list.items.length}` : `${s.section.blocks.length} blocks`))
  console.log(`${STORE}: ${counts.join(', ')}`)
  for (const p of products) console.log(`${p.path}: ${p.title}, ${p.price}, ${p.pictures.length} pictures`)
  console.log(`${CART}: "${cartPage.title}" / "${cartPage.emptyMessage}"`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
