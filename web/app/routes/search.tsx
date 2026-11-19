import { Fragment, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useSearchParams, type ShouldRevalidateFunctionArgs } from 'react-router'
import { searchIndex } from '~/content/searchIndex'
import { focal, pictureSrc, srcSet } from '~/site/Picture'
import { prepare, search, type Result } from '~/site/search'
import type { Route } from './+types/search'

/** The pages to search and their words, read from the content files when the site is built (content/searchIndex.ts). */
export async function loader() {
  return { entries: await searchIndex() }
}

/** A new query only changes the address: the pages to search stay as they are. */
export function shouldRevalidate({ currentUrl, nextUrl, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  return currentUrl.pathname === nextUrl.pathname ? false : defaultShouldRevalidate
}

export function meta() {
  return [{ title: 'EduBud International' }, { name: 'robots', content: 'noindex, nofollow' }]
}

/**
 * As the original's: a search starts once typing has paused for a second (or at once with Enter, which ours adds);
 * the results showing fade out (0.1 s) and the new ones fade in (0.15 s) a moment later.
 */
const PAUSE = 1000
const SWAP = 150

/**
 * The search page, as the original's: a field, and below it the pages found, each with its name and an excerpt. The
 * query is in the address (`/search?q=summer`), so a search can be linked to, and Back returns to the one before.
 */
export default function SearchPage({ loaderData }: Route.ComponentProps) {
  const pages = useMemo(() => prepare(loaderData.entries), [loaderData.entries])
  const [params, setParams] = useSearchParams()
  const address = params.get('q') ?? ''
  // The query whose results show, and whether they're fading out for the next one's.
  const [query, setQuery] = useState('')
  const [fading, setFading] = useState(false)
  const results = useMemo(() => search(pages, query), [pages, query])
  const input = useRef<HTMLInputElement>(null)
  const pause = useRef(0)
  const swap = useRef(0)
  // The query the address holds as far as this page knows: the last one it searched for or was given.
  const known = useRef<string | null>(null)

  // A query in the address, on arrival and when Back or Forward returns to another search: its results at once. (The
  // page is built without one, so it's read once the page runs.)
  useEffect(() => {
    if (address === known.current) return
    known.current = address
    clearTimeout(pause.current)
    clearTimeout(swap.current)
    if (input.current) input.current.value = address
    setQuery(address)
    setFading(false)
  }, [address])

  // On arrival the field has the focus, with a query from the address selected, ready to type over, as the original's.
  // Not on touch screens when there's a query: the keyboard would cover its results.
  useEffect(() => {
    const field = input.current
    if (!field || (field.value && !matchMedia('(pointer: fine)').matches)) return
    field.focus()
    field.select()
  }, [])

  useEffect(
    () => () => {
      clearTimeout(pause.current)
      clearTimeout(swap.current)
    },
    [],
  )

  function find(text: string) {
    clearTimeout(pause.current)
    const q = text.trim()
    if (q === known.current) return
    known.current = q
    setParams(q ? { q } : {}, { preventScrollReset: true })
    setFading(true)
    clearTimeout(swap.current)
    swap.current = window.setTimeout(() => {
      setQuery(q)
      setFading(false)
    }, SWAP)
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const text = e.currentTarget.value
    clearTimeout(pause.current)
    pause.current = window.setTimeout(() => find(text), PAUSE)
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    find(input.current?.value ?? '')
    // On a touch screen, the keyboard goes away to show the results.
    if (matchMedia('(pointer: coarse)').matches) input.current?.blur()
  }

  return (
    <div className="system-page">
      <div className="search-page">
        <h1 className="visually-hidden">Search</h1>
        {/* Before the page's scripts have run, Enter still loads /search?q=…, whose results show once they do. */}
        <form className="search-box" role="search" action="/search" onSubmit={onSubmit}>
          <Magnifier />
          <label className="visually-hidden" htmlFor="search-input">
            Search
          </label>
          <input
            ref={input}
            id="search-input"
            className="search-input"
            type="search"
            name="q"
            placeholder="Type to search…"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            onChange={onChange}
          />
        </form>
        <div className={`search-output${fading ? ' is-fading' : ''}`}>
          {/* Said politely by screen readers: how many pages were found, or that none were. */}
          <div className="search-notice" role="status">
            {query && !results.length && 'Your search did not match any results. Try a different search.'}
            {results.length > 0 && (
              <span className="visually-hidden">
                {results.length === 1 ? '1 result' : `${results.length} results`} for “{query}”
              </span>
            )}
          </div>
          {results.length > 0 && (
            <ol className="search-results" role="list">
              {results.map((result) => (
                <SearchResult key={result.entry.href} result={result} />
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}

/** A page found: its name (the link, though the whole result can be clicked), the excerpt, and a product's picture. */
function SearchResult({ result }: { result: Result }) {
  const { entry, fragments } = result
  return (
    <li className="search-result">
      {entry.picture && (
        <div className="search-result-picture">
          <img
            src={pictureSrc(entry.picture, 500)}
            srcSet={srcSet(entry.picture)}
            sizes="(max-width: 767px) 120px, calc(20vw - 32px)"
            alt=""
            loading="lazy"
            decoding="async"
            style={{ objectPosition: focal(entry.picture) }}
          />
        </div>
      )}
      <div className="search-result-main">
        <h2 className="search-result-title">
          <a href={entry.href}>{entry.title}</a>
        </h2>
        <div className="search-result-excerpt">
          {fragments.map((pieces, i) => (
            <Fragment key={i}>
              <span>{pieces.map((p, j) => (p.found ? <em key={j}>{p.text}</em> : p.text))}</span> <span>…</span>{' '}
            </Fragment>
          ))}
        </div>
      </div>
    </li>
  )
}

/** The original's magnifier, drawn after its icon (32px): a thin ring and a short, thick handle. */
function Magnifier() {
  return (
    <svg className="search-icon" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="13" cy="13" r="9.8" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M19.2 19.2 27.75 27.75" stroke="currentColor" strokeWidth="4.25" />
    </svg>
  )
}
