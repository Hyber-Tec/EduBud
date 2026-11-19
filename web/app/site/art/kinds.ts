import type { CreateArt } from './types'

/**
 * The kinds of art we draw (the section's `settings.type`), each in its own file, loaded only on pages that have it.
 * A kind not listed keeps its section's picture of the art.
 */
export const KINDS: Record<string, () => Promise<{ create: CreateArt }>> = {
  conic: () => import('./conic'),
  bokeh: () => import('./bokeh'),
  gradient: () => import('./gradient'),
  contours: () => import('./contours'),
  isometric: () => import('./isometric'),
  surface: () => import('./surface'),
}
