import type { PageMeta } from '~/content/types'

/** A shop page's title and description, as the original's; like every page of the copy, hidden from search engines. */
export function shopMeta(meta: PageMeta | undefined) {
  if (!meta) return [{ title: 'EduBud International' }, { name: 'robots', content: 'noindex, nofollow' }]
  return [
    { title: meta.title },
    { name: 'description', content: meta.description },
    { property: 'og:title', content: meta.title },
    { property: 'og:description', content: meta.description },
    { name: 'robots', content: 'noindex, nofollow' },
  ]
}
