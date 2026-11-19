// The search page's search (routes/search.tsx), in the browser: the pages whose name or text hold every word of the
// query, those with them in their name first, each with an excerpt showing the words found, as the original's do.
import type { SearchEntry } from '~/content/searchIndex'

/** A word of a text: where it is, and how it's compared (lower case, without accents or apostrophes). */
interface Word {
  start: number
  end: number
  key: string
}

/** A page made ready to search: the words of its name and of its text. */
export interface Searchable {
  entry: SearchEntry
  title: Word[]
  text: Word[]
}

/** A stretch of an excerpt, and whether it's a word searched for (shown in italics). */
export interface Piece {
  text: string
  found: boolean
}

export interface Result {
  entry: SearchEntry
  /** The excerpt, as the original's: the page's name when it holds a word searched for, then a stretch of its text. */
  fragments: Piece[][]
}

/** About how many characters of the text an excerpt shows, as the original's. */
const LENGTH = 100

const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu
const key = (word: string) => word.normalize('NFD').replace(/\p{M}/gu, '').replace(/['’]/g, '').toLowerCase()

function words(text: string): Word[] {
  return [...text.matchAll(WORD)].map((m) => ({ start: m.index, end: m.index + m[0].length, key: key(m[0]) }))
}

export function prepare(entries: SearchEntry[]): Searchable[] {
  return entries.map((entry) => ({ entry, title: words(entry.title), text: words(entry.text) }))
}

/**
 * How well a word of the text matches a word of the query: 2 when it's the same word or its plural, 1 when it only
 * starts with it ("volun" finds "volunteer"), 0 when it doesn't.
 */
function fit(word: string, q: string): number {
  if (!word.startsWith(q)) return 0
  const rest = word.slice(q.length)
  return rest === '' || rest === 's' || rest === 'es' ? 2 : 1
}

const isFound = (w: Word, qs: string[]) => qs.some((q) => fit(w.key, q) > 0)

/** The text from `start` to `end`, the words searched for marked. */
function pieces(text: string, ws: Word[], qs: string[], start: number, end: number): Piece[] {
  const out: Piece[] = []
  let at = start
  for (const w of ws) {
    if (w.start < start || w.end > end || !isFound(w, qs)) continue
    if (w.start > at) out.push({ text: text.slice(at, w.start), found: false })
    out.push({ text: text.slice(w.start, w.end), found: true })
    at = w.end
  }
  if (at < end) out.push({ text: text.slice(at, end), found: false })
  return out
}

/**
 * The stretch of text an excerpt around a word shows: from the start of its sentence, if the word is then within
 * LENGTH characters, or else from a few words before it; to the end of a sentence if one ends soon after it, or else
 * to the end of a word about LENGTH characters on.
 */
function stretch(page: Searchable, w: Word): [number, number] {
  const text = page.entry.text
  let start = 0
  for (const m of text.slice(0, w.start).matchAll(/[.!?]\s+/g)) start = m.index + m[0].length
  if (w.end - start > LENGTH) start = page.text.find((o) => o.start >= w.start - 40)?.start ?? w.start
  const stop = /[.!?](?=\s|$)/g
  stop.lastIndex = Math.max(w.end, start + 50)
  const end = stop.exec(text)
  if (end && end.index < start + LENGTH + 20) return [start, end.index + 1]
  return [start, Math.max(w.end, page.text.find((o) => o.end >= start + LENGTH)?.end ?? text.length)]
}

/** A page's excerpt: the stretch of its text with the most of the query's words (the first such), whole words first. */
function excerpt(page: Searchable, qs: string[]): Piece[] | null {
  const found = page.text.filter((w) => isFound(w, qs))
  let best: [number, number] | null = null
  let bestScore = 0
  for (const w of found) {
    const [start, end] = stretch(page, w)
    const inside = found.filter((o) => o.start >= start && o.end <= end)
    const kinds = new Set(inside.map((o) => qs.find((q) => fit(o.key, q) > 0))).size
    const score = kinds * 1000 + inside.reduce((sum, o) => sum + Math.max(...qs.map((q) => fit(o.key, q))), 0)
    if (score > bestScore) [best, bestScore] = [[start, end], score]
  }
  return best && pieces(page.entry.text, page.text, qs, ...best)
}

/** The pages holding every word of the query: those with them in their name first, then those with them most often. */
export function search(pages: Searchable[], query: string): Result[] {
  const qs = [...new Set(words(query).map((w) => w.key))]
  if (!qs.length) return []
  const found: { page: Searchable; inTitle: number; inText: number }[] = []
  for (const page of pages) {
    let inTitle = 0
    let inText = 0
    const every = qs.every((q) => {
      const t = Math.max(0, ...page.title.map((w) => fit(w.key, q)))
      const n = page.text.reduce((sum, w) => sum + fit(w.key, q), 0)
      inTitle += t
      inText += Math.log2(1 + n)
      return t > 0 || n > 0
    })
    if (every) found.push({ page, inTitle, inText })
  }
  // A stable sort: pages that tie keep the menu's order.
  return found
    .sort((a, b) => b.inTitle - a.inTitle || b.inText - a.inText)
    .map(({ page }) => {
      const { entry, title } = page
      const fragments: Piece[][] = []
      if (title.some((w) => isFound(w, qs))) fragments.push(pieces(entry.title, title, qs, 0, entry.title.length))
      const body = excerpt(page, qs)
      if (body) fragments.push(body)
      return { entry, fragments }
    })
}
