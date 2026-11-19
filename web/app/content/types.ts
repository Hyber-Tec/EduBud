// The website's content, as `scripts/capture` reads it from the original site (edubud.org, made on Squarespace).
// A page is a list of sections; a section lays its blocks on a grid of 8 columns on phones and 24 from 768 px wide,
// each block placed by its rows and columns (the original's own numbers), so the copy matches at every width.

/** A section's color theme: which colors its text, buttons and background use (`site/styles/themes.css`). */
export type Theme =
  | ''
  | 'white'
  | 'white-bold'
  | 'light'
  | 'light-bold'
  | 'dark'
  | 'black'
  | 'black-bold'
  | 'bright'
  | 'bright-inverse'

/** CSS custom properties a block or section sets on itself: the original's settings for it, by name. */
export type Vars = Record<string, string>

/** Where a block sits on its section's grid: rows and columns as CSS grid lines, its layer, and its alignment. */
export interface Area {
  rowStart: number
  colStart: number
  rowEnd: number
  colEnd: number
  z: number
  /** Horizontal alignment of the block's content (flex `justify-content`). */
  justify?: string
  /** Vertical alignment of the block's content (flex `align-items`). */
  align?: string
}

export interface Grid {
  mobile: { rows: number; rowMin: string; gap: number; colGap: number }
  /** Desktop rows grow with the container: `container width × scale` at the least. */
  desktop: { rows: number; scale: number; gap: number; colGap: number }
}

/** A picture, in the widths Squarespace serves it (`/media/<id>/<width>.<ext>`). */
export interface Picture {
  /** The folder of its files, e.g. `/media/24693b9d`. */
  base: string
  ext: string
  widths: number[]
  width: number
  height: number
  alt: string
  /** Focal point, 0–1 from the left and the top. */
  focal?: [number, number]
}

export interface VideoFile {
  src: string
  /** Its first frame, shown until it plays. */
  poster?: Picture
  width: number
  height: number
}

export interface Link {
  href: string
  newWindow?: boolean
}

/**
 * A pose a block moves to on hover or press, or starts from when it appears: an offset (px, or % of the block's own
 * size), a turn (degrees), a stretch (1 = as it is) and a slant (degrees), added to the block's own transform.
 */
export interface MotionPose {
  x: string
  y: string
  rotate: number
  scaleX: number
  scaleY: number
  skewX: number
  skewY: number
}

/** One of a block's animations: a spring of this length (ms) and bounciness (0 to 1), after a delay (ms). */
export interface MotionStep {
  pose: MotionPose
  duration: number
  delay: number
  bounce: number
}

/**
 * A block's animations, as set on the original ("block animations"): it moves to a pose while the mouse is over it,
 * or while it's pressed; and once, as it scrolls into view, it moves from a pose to its place. "point" is which edge
 * of the block (or its middle) has to rise above a line "threshold" % up the window (0: its bottom; -100: a whole
 * window below it).
 */
export interface Motion {
  hover?: MotionStep
  press?: MotionStep
  appear?: MotionStep & { point: 'top' | 'middle' | 'bottom'; threshold: number }
}

interface BlockBase {
  id: string
  mobile: Area
  desktop: Area
  /** Its animations, if it has any. */
  motion?: Motion
  /** Settings on the block (both widths), and those for phones only. */
  vars?: Vars
  varsMobile?: Vars
  /** The block's own rules that aren't variables (borders, clipping), already scoped to it. */
  css?: string
  /** The block has its own background color (a card), from its settings or its section's theme. */
  background?: boolean
}

export interface TextBlock extends BlockBase {
  type: 'text'
  /** The text, as rich-text HTML: headings, paragraphs, lists, links, emphasis, the theme's text colors. */
  html: string
}

export interface ImageBlock extends BlockBase {
  type: 'image'
  picture: Picture
  link?: Link
  /** Picture fills its block (cropped around the focal point) rather than keeping its own shape. */
  stretched: boolean
  /** An SVG mask shape over the picture, if the original uses one. */
  maskSvg?: string
  /** Where the picture sits when it's narrower than its block (its "image position"); the middle when not set. */
  position?: 'left' | 'right'
}

export interface ShapeBlock extends BlockBase {
  type: 'shape'
  name: string
  /** The shape's SVG path(s), and the box they're drawn in (`0 0 100 100`, `0 0 150 100`). */
  svg: string
  viewBox: string
  /** Fills its block whatever the shape's proportions; otherwise it keeps them, as large as the block allows. */
  stretched: boolean
  /** The shape phones show, when the original gives them another one. */
  phone?: { name: string; svg: string; viewBox: string; stretched: boolean }
  /**
   * A rectangle's rounded corners (px: top left, top right, bottom right, bottom left). The original works out a
   * rectangle's path in the browser for the block's size; ours is a box with these corners.
   */
  corners?: [number, number, number, number]
  /** Text inside the shape, as rich-text HTML, and its link. */
  html?: string
  link?: Link
}

export interface ButtonBlock extends BlockBase {
  type: 'button'
  label: string
  link?: Link
  kind: 'primary' | 'secondary' | 'tertiary'
  size: 'small' | 'medium' | 'large'
  alignment: 'left' | 'center' | 'right'
  stretched: boolean
}

export interface AccordionItem {
  title: string
  html: string
}

export interface AccordionBlock extends BlockBase {
  type: 'accordion'
  items: AccordionItem[]
  firstOpen: boolean
  allowMultiple: boolean
  dividers: { enabled: boolean; first: boolean; last: boolean }
  icon: 'plus' | 'arrow'
  /** The titles' element: a paragraph, or a heading (h1–h4) drawn in the heading's style. */
  titleTag: 'p' | 'h1' | 'h2' | 'h3' | 'h4'
  titleClass: string
  descriptionClass: string
  titleAlign: string
  descriptionAlign: string
  /** Where the description sits when narrower than the item: left, center or right. */
  descriptionPlacement: string
  iconPlacement: 'left' | 'right'
}

export interface MarqueeBlock extends BlockBase {
  type: 'marquee'
  items: string[]
  textStyle: string
  speed: number
  direction: 'left' | 'right'
  /** How far the line waves up and down (px; 0 = straight), and its waves' frequency setting. */
  waveIntensity: number
  waveFrequency: number
  link?: Link
  container: Record<string, unknown>
}

export interface VideoBlock extends BlockBase {
  type: 'video'
  /** A YouTube embed, or a video Squarespace hosted (`file`). */
  provider: 'youtube' | 'native'
  videoId?: string
  file?: VideoFile
  title: string
  /** Height as a share of the width, in percent (the embed's padding). */
  ratio: number
}

export interface LineBlock extends BlockBase {
  type: 'line'
}

export interface FormField {
  kind: 'name' | 'email' | 'text' | 'textarea' | 'checkbox' | 'select' | 'phone' | 'hidden'
  label: string
  required: boolean
  placeholder?: string
  /** A name field's two parts. */
  parts?: { label: string; placeholder?: string }[]
  options?: string[]
  description?: string
}

export interface FormBlock extends BlockBase {
  type: 'form'
  /** The original form's settings and fields, read from its configuration. */
  config: Record<string, unknown>
}

export interface MapBlock extends BlockBase {
  type: 'map'
  lat: number
  lng: number
  zoom: number
  /** A picture of the map as the original draws it, for the copy to show. */
  snapshot?: Picture
}

export interface DonationBlock extends BlockBase {
  type: 'donation'
  config: Record<string, unknown>
}

export interface InstagramBlock extends BlockBase {
  type: 'instagram'
  posts: { picture: Picture; href: string }[]
  html: string
}

/** A block the copy draws from a picture of the original (used where a live widget can't be copied). */
export interface SnapshotBlock extends BlockBase {
  type: 'snapshot'
  picture: Picture
  label: string
}

export type Block =
  | TextBlock
  | ImageBlock
  | ShapeBlock
  | ButtonBlock
  | AccordionBlock
  | MarqueeBlock
  | VideoBlock
  | LineBlock
  | FormBlock
  | MapBlock
  | DonationBlock
  | InstagramBlock
  | SnapshotBlock

/**
 * A generative background's settings as the original stores them (its section's `data-current-styles` →
 * `generative`): the kind (`type`), its speeds, shapes and colors. Colors are the original's references to the site's
 * palette (`{ type: 'SITE_PALETTE_COLOR', sitePaletteColor: { id, alpha } }`) or custom colors; the page resolves them
 * against our theme's (site/art/colors.ts).
 */
export type GenerativeSettings = { type: string } & Record<string, unknown>

export interface SectionBackground {
  image?: Picture
  video?: VideoFile & { filter?: string; speed?: number }
  /**
   * Animated art the original draws in the page: Squarespace's "generative" backgrounds (`settings`, drawn by
   * site/art/), or an effect on the background picture. Also pictures of it taken at a few widths
   * (scripts/capture/art.ts), each shown up to its `upTo` window width until the art is drawn, and wherever it can't be.
   */
  art?: { kind: string; images: { src: string; width: number; height: number; upTo?: number }[]; settings?: GenerativeSettings }
  overlayOpacity?: number
}

export interface Section {
  id: string
  /** A grid of blocks (most sections), a gallery of pictures, or an "auto layout" list of items. */
  kind?: 'gallery' | 'list'
  theme: Theme
  /** Layout classes: height, content width, alignment, background width. */
  classes: string[]
  background?: SectionBackground
  /** A shape cutting the section's bottom edge, as an SVG clip path in a 0–1 box. */
  divider?: { clipPath: string; css?: string }
  vars?: Vars
  grid: Grid
  blocks: Block[]
}

export interface PageMeta {
  title: string
  description: string
  image?: string
}

export interface Page {
  path: string
  meta: PageMeta
  sections: Section[]
}
