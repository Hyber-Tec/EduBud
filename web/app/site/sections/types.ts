// The gallery and list sections' content, as scripts/capture/galleries.ts reads it from the original into
// content/galleries.json (keyed by section id). The page files list these sections; their pictures and items are here.
import type { Link, Picture } from '../../content/types'

export interface GalleryItem {
  picture: Picture
  /** The original's `sizes` for the picture, so the browser picks the same file from the same widths. */
  sizes?: string
  caption?: string
  link?: Link
}

/** How a gallery lays out its pictures: a grid of equal cells, a sideways reel, justified rows, or columns. */
export type GalleryDesign = 'grid' | 'reel' | 'strips' | 'masonry'

export interface GallerySectionData {
  type: 'gallery'
  design: GalleryDesign
  /** Edge to edge, inside the page's padding, or inside the page's maximum width. */
  width: 'full-bleed' | 'full' | 'inset'
  /** How pictures appear as they scroll into view: `scale-up`, `fade-up`… or `none` (the site's default is off). */
  animation: string
  captions: boolean
  lightbox: boolean
  /** Grid and masonry: columns on a computer (fewer on smaller windows); grid: each cell's shape. */
  columns?: number
  aspectRatio?: string
  /** The space between pictures, the original's setting (0–100). */
  gutter?: number
  /** Strips: the height rows aim for before they're stretched to the full width. */
  rowHeight?: number
  /** Reel: where its arrows sit, whether pictures are cropped to the window, and its height in % of the window. */
  controls?: string
  cropping?: boolean
  viewportHeight?: number
  items: GalleryItem[]
}

/** A length as the original's settings write it: `{ value: 4, unit: '%' }` becomes `4%`. */
export type Length = string

export interface ListItem {
  title: string
  /** The item's text, as rich-text HTML. */
  html: string
}

/** An "auto layout" list section. The original offers several layouts; EduBud uses the banner slideshow. */
export interface ListSectionData {
  type: 'list'
  layout: 'banner-slideshow'
  /** Endless: after the last slide comes the first. */
  infinite: boolean
  layoutWidth: 'full-bleed' | 'full' | 'inset'
  titleAlign: string
  bodyAlign: string
  cardVertical: 'top' | 'middle' | 'bottom'
  cardHorizontal: 'left' | 'center' | 'right'
  /** The section's own padding above and below. */
  paddingTop: Length
  paddingBottom: Length
  minSlideHeight: Length
  /** Each slide's padding: top, right, bottom, left. */
  slidePadding: [Length, Length, Length, Length]
  spaceBetweenSlides: { value: number; unit: string }
  spaceBelowTitle: Length
  slideContentWidth: Length
  /** Arrows (or none), where they sit, and their distance from the section's bottom edge. */
  navigation: string
  navigationPlacement: string
  navigationAlignment: 'left' | 'center' | 'right'
  navigationOffset: Length
  /** Text sizes, in the original's units (1 = 1rem, growing with the window like the site's other text). */
  titleSize: number
  bodySize: number
  /** The titles' heading level (their line height is that heading's). */
  titleTag: 'h1' | 'h2' | 'h3' | 'h4'
  /** The section theme's colors for the list's text and arrows. */
  colors: { title: string; description: string; arrow: string; arrowBackground: string }
  items: ListItem[]
}

export type SectionContent = GallerySectionData | ListSectionData
