// What the search page searches (routes/search.tsx), as the original's does: the content pages, the shop and its
// products, each with its name, address and words. Read from the content files when the site is built; the search
// page carries the result, and nothing else does.
import { contentFor } from '~/site/sections/content'
import { loadPage } from './load'
import { PAGES } from './paths'
import { loadProduct, loadStore } from './shop/load'
import site from './site.json'
import type { Block, Picture, Section } from './types'

export interface SearchEntry {
  /** The page's name, as the original's search shows it. */
  title: string
  href: string
  /** Its words in reading order, as one line of plain text. */
  text: string
  /** A product's picture, shown beside it. */
  picture?: Picture
}

interface NavLink {
  title: string
  href: string
  items?: NavLink[]
}

/** The pages' names: the menu's, and for the two pages the menu doesn't list, the original's own. */
function pageTitles(): Record<string, string> {
  const titles: Record<string, string> = { '/': 'Home', '/founder-message': 'Founder Message' }
  for (const item of site.header.nav as NavLink[]) {
    // A folder's pages, or a page of its own (Shop).
    for (const link of item.items ?? [item]) if (link.href) titles[link.href] = link.title
  }
  return titles
}

/** A block's words: its text, a button's label, an accordion's titles and text. */
function blockText(b: Block): string[] {
  switch (b.type) {
    case 'text':
      return [b.html]
    case 'shape':
      return b.html ? [b.html] : []
    case 'button':
      return [b.label]
    case 'accordion':
      return b.items.flatMap((item) => [item.title, item.html])
    default:
      // Pictures, videos, forms and scrolling text aren't searched.
      return []
  }
}

/** A section's words: its blocks', or a list's items'. */
function sectionText(section: Section): string[] {
  const list = contentFor(section.id)
  if (list?.type === 'list') return list.items.flatMap((item) => [item.title, item.html])
  return section.blocks.flatMap(blockText)
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

/** Rich text as plain text: the tags dropped (the end of a paragraph, heading or line is a space), entities read. */
export function plainText(html: string): string {
  return html
    .replace(/<br\b[^>]*>|<\/(p|h[1-6]|li|div)>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
      if (code[0] !== '#') return ENTITIES[code.toLowerCase()] ?? entity
      return String.fromCodePoint(code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : Number(code.slice(1)))
    })
    .replace(/\s+/g, ' ')
    .trim()
}

/** Every page the search covers, in the menu's order: the content pages, then the shop and its products. */
export async function searchIndex(): Promise<SearchEntry[]> {
  const titles = pageTitles()
  const entries: SearchEntry[] = []
  for (const [href, slug] of Object.entries(PAGES)) {
    const page = await loadPage(slug)
    if (page) entries.push({ title: titles[href] ?? page.meta.title, href, text: plainText(page.sections.flatMap(sectionText).join(' ')) })
  }
  const store = await loadStore()
  const shopText = store.sections.flatMap((s) => (s.kind === 'section' ? sectionText(s.section) : []))
  entries.push({ title: titles[store.path] ?? 'Shop', href: store.path, text: plainText(shopText.join(' ')) })
  // Each product with its picture in the shop's grid, as the original's search shows it.
  for (const s of store.sections) {
    if (s.kind !== 'products') continue
    for (const card of s.list.items) {
      const product = await loadProduct(card.href.split('/').pop() ?? '')
      entries.push({ title: card.title, href: card.href, text: plainText(product?.description ?? ''), picture: card.picture })
    }
  }
  return entries
}
