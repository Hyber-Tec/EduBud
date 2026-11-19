import type { CreateArt } from './types'

/**
 * The kinds of art we draw (a section's `settings.type`, an image block's `effect.type`), each in its own file,
 * loaded only on pages that have it. A kind not listed keeps its section's picture of the art (an effect on a
 * picture: the picture, still).
 */
export const KINDS: Record<string, () => Promise<{ create: CreateArt }>> = {
  conic: () => import('./conic'),
  bokeh: () => import('./bokeh'),
  gradient: () => import('./gradient'),
  contours: () => import('./contours'),
  isometric: () => import('./isometric'),
  surface: () => import('./surface'),
  parallax: () => import('./parallax'),
  filmGrain: () => import('./filmGrain'),
}
