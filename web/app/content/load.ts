import type { Page } from './types'

// Each page's content is its own file, read when the site is built (never sent whole to the browser).
const files = import.meta.glob<{ default: Page }>('./pages/*.json')

export async function loadPage(slug: string): Promise<Page | null> {
  const file = files[`./pages/${slug}.json`]
  return file ? (await file()).default : null
}
