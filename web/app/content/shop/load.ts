import type { CartPage, Product, StorePage } from './types'

// The shop's content files, read when the site is built (never sent whole to the browser).
const products = import.meta.glob<{ default: Product }>('./products/*.json')

export async function loadStore(): Promise<StorePage> {
  return (await import('./store.json')).default as unknown as StorePage
}

/** A product page's content, by the last part of its address (`edubud-community-center-tote`). */
export async function loadProduct(slug: string): Promise<Product | null> {
  const file = products[`./products/${slug}.json`]
  return file ? (await file()).default : null
}

export async function loadCart(): Promise<CartPage> {
  return (await import('./cart.json')).default as unknown as CartPage
}
