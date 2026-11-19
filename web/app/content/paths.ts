// The site's addresses: the pages read from the original, the shop's, and the "page not found" page.

/** Content pages, by address, and the file each one's content is in (`pages/<slug>.json`). */
export const PAGES: Record<string, string> = {
  '/': 'home',
  '/day-learning-program': 'day-learning-program',
  '/summer-program': 'summer-program',
  '/community-chapters': 'community-chapters',
  '/golden-bridge-project': 'golden-bridge-project',
  '/blue-bridge-project': 'blue-bridge-project',
  '/california-schools-fire-relief-project': 'california-schools-fire-relief-project',
  '/voices-of-the-vulnerable': 'voices-of-the-vulnerable',
  '/mentors-corner': 'mentors-corner',
  '/our-team': 'our-team',
  '/resources': 'resources',
  '/support-us': 'support-us',
  '/founder-message': 'founder-message',
}

/** The original's second address for its homepage. */
export const ALIASES: Record<string, string> = { '/home': '/' }

export const SHOP_PATHS = [
  '/products-store',
  '/products-store/p/edubud-community-center-tote',
  '/products-store/p/edubud-community-center-cap',
  '/products-store/p/edubud-community-center-hoodie',
  '/products-store/p/the-echo-vase-llhgn',
  '/cart',
]

export const PRERENDER = [...Object.keys(PAGES), ...Object.keys(ALIASES), ...SHOP_PATHS, '/404']
