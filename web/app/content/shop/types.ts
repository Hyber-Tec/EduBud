// The shop's content, as `scripts/capture/shop.ts` reads it from the original site: the store page with its product
// grid, the four product pages, and the cart. Buying does nothing yet (docs/DECISIONS.md §3), so there are no prices to
// charge or stock to count here: only what the pages show.
import type { PageMeta, Picture, Section, Theme } from '../types'

/** CSS custom properties, by name: the original's settings for a part of the shop. */
export type Vars = Record<string, string>

/** One product in the store's grid. */
export interface ProductCard {
  title: string
  /** The product page's address. */
  href: string
  /** As the original shows it, e.g. `$20.00`. */
  price: string
  picture: Picture
  /** The picture that fades in while the pointer is over the card. */
  hoverPicture?: Picture
  /** The button's label ("Add To Cart"). */
  button: string
}

/** The store's product grid (the original's "product list" section). */
export interface ProductList {
  id: string
  theme: Theme
  /** The collection's title, shown above the grid on phones only ("Shop"). */
  title: string
  /** The grid's settings: columns, spacing, the pictures' shape, the section's padding. */
  vars: Vars
  items: ProductCard[]
}

export type StoreSection = { kind: 'section'; section: Section } | { kind: 'products'; list: ProductList }

export interface StorePage {
  path: string
  meta: PageMeta
  sections: StoreSection[]
}

/** A product page. */
export interface Product {
  path: string
  meta: PageMeta
  theme: Theme
  /** The links above the product on computers: the shop, then the product itself. */
  breadcrumb: { title: string; href: string }[]
  title: string
  price: string
  /** The description, as rich-text HTML. */
  description: string
  /** The gallery's pictures, in order. */
  pictures: Picture[]
  /** The button's label ("Add To Cart"). */
  button: string
  /** The page's layout settings: the gallery's width and shape, its arrows' size, the space beside it. */
  vars: Vars
}

/** The cart page, as the original shows it with nothing in the cart. */
export interface CartPage {
  path: string
  meta: PageMeta
  theme: Theme
  title: string
  emptyMessage: string
  button: { label: string; href: string }
}
