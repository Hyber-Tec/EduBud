import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { useLocation } from 'react-router'
import site from '~/content/site.json'
import type { Picture } from '~/content/types'
import { LOGIN_HREF, MENU_PAGES } from './menu'
import { pictureSrc, srcSet } from './Picture'

interface NavPage {
  title: string
  href: string
}
interface NavItem extends NavPage {
  items?: NavPage[]
}

const nav = site.header.nav as NavItem[]
const logo = site.header.logo as unknown as Picture

/** A thin arrowhead pointing down (it turns to point up while its menu is open). */
function Caret({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** How long the pointer must rest on a folder's name before its menu opens, and be away before it closes (ms). */
const OPEN_DELAY = 60
const CLOSE_DELAY = 200

const folderId = (title: string) => 'folder-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-')

/**
 * The site's header: the logo, the menu and the "Log In" button; on phones, a button that opens the menu full screen.
 * It hides while the page scrolls down and comes back when it scrolls up, as the original's does.
 *
 * The folders' drop-downs and the phone menu are ours (the owner, 2026-11-19): a folder opens a card listing its pages,
 * each with a picture and a line about it, when the pointer rests on its name, on a click or tap, or from the keyboard;
 * on phones the folders open in place.
 */
export function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [shrink, setShrink] = useState(false)
  const header = useRef<HTMLElement>(null)
  const { pathname } = useLocation()
  const here = (href: string) => href !== '/' && (pathname === href || pathname.startsWith(href + '/'))

  // The original's "scroll back" header: once the page has scrolled (more than 10px), scrolling down hides it, and
  // scrolling up brings it back after 200px without a pause of more than half a second. At the top, or while
  // something in it has the keyboard's focus or a drop-down is open, it shows. While scrolled it "shrinks" (shorter on
  // phones).
  useEffect(() => {
    let last = window.scrollY
    let distance = 0
    let then = 0
    let shrinkTimer = 0
    const onScroll = () => {
      const y = window.scrollY
      const scrolled = y > 10
      const busy = header.current?.matches(':focus-within') || header.current?.querySelector('.header-nav-item--folder.is-open')
      if (!scrolled || busy) setHidden(false)
      else if (y > last) setHidden(true)
      else if (y < last) {
        const now = Date.now()
        distance += last - y
        if (now - then > 500) distance = 0
        if (distance > 200) setHidden(false)
        then = now
      }
      window.clearTimeout(shrinkTimer)
      if (scrolled) setShrink(true)
      else shrinkTimer = window.setTimeout(() => setShrink(false), 300)
      last = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.clearTimeout(shrinkTimer)
    }
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('menu-open', menuOpen)
    if (!menuOpen) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  return (
    <header
      ref={header}
      className={`site-header${hidden && !menuOpen ? ' site-header--hidden' : ''}${shrink ? ' shrink' : ''}${menuOpen ? ' site-header--menu-open' : ''}`}
      data-theme=""
    >
      {/* For keyboards: the first thing Tab reaches, shown only then (as on the original). */}
      <a href="#page" className="button button--primary header-skip-link">
        Skip to Content
      </a>
      <div className="header-inner">
        <a className="header-logo" href={site.header.logoHref || '/'}>
          <img src={pictureSrc(logo, 1500)} srcSet={srcSet(logo)} sizes="100px" alt={logo.alt} />
        </a>
        <DesktopNav here={here} />
        <a className="header-cta" href={LOGIN_HREF}>
          Log In
        </a>
        <button
          type="button"
          className={`header-burger${menuOpen ? ' header-burger--open' : ''}`}
          aria-label={menuOpen ? 'Close Menu' : 'Open Menu'}
          aria-expanded={menuOpen}
          aria-controls="header-menu"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span className="burger-box">
            <span className="burger-line burger-line--top" />
            <span className="burger-line burger-line--bottom" />
          </span>
        </button>
      </div>
      <PhoneMenu open={menuOpen} here={here} />
    </header>
  )
}

/** The menu on wider screens: links, and folders whose drop-down opens on hover, click or keyboard. */
function DesktopNav({ here }: { here: (href: string) => boolean }) {
  const [open, setOpen] = useState<string | null>(null)
  // Whether the open folder was opened by the pointer resting on it (then it closes when the pointer leaves) or by a
  // click (then it stays until clicked again, Escape, or a click elsewhere).
  const openedBy = useRef<'hover' | 'click'>('hover')
  const timer = useRef(0)
  const list = useRef<HTMLUListElement>(null)

  const later = (fn: () => void, ms: number) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(fn, ms)
  }
  useEffect(() => () => window.clearTimeout(timer.current), [])

  // A click or tap outside the menu closes an open folder.
  useEffect(() => {
    if (!open) return
    const onDown = (e: globalThis.PointerEvent) => {
      if (!list.current?.contains(e.target as Node)) setOpen(null)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  // Keeps an open card inside the window: centered under its folder's name, moved in from the edge if need be.
  useLayoutEffect(() => {
    if (!open) return
    const card = document.getElementById(folderId(open))
    if (!card) return
    card.style.setProperty('--nudge', '0px')
    const r = card.getBoundingClientRect()
    const margin = 16
    const nudge = r.right > window.innerWidth - margin ? window.innerWidth - margin - r.right : r.left < margin ? margin - r.left : 0
    card.style.setProperty('--nudge', `${nudge}px`)
  }, [open])

  const onEnter = (title: string) => (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    // While a folder is open, moving onto the next one switches at once; otherwise the pointer must rest a moment.
    if (open === title) return window.clearTimeout(timer.current)
    if (open) return later(() => setOpen(title), 0)
    openedBy.current = 'hover'
    later(() => setOpen(title), OPEN_DELAY)
  }
  const onLeave = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    if (openedBy.current === 'click' && open) return
    later(() => setOpen(null), CLOSE_DELAY)
  }
  const onClick = (title: string) => {
    window.clearTimeout(timer.current)
    if (open === title && openedBy.current === 'hover') return void (openedBy.current = 'click')
    openedBy.current = 'click'
    setOpen(open === title ? null : title)
  }
  const onKeyDown = (title: string) => (e: KeyboardEvent<HTMLLIElement>) => {
    const card = document.getElementById(folderId(title))
    const links = [...(card?.querySelectorAll<HTMLAnchorElement>('a') ?? [])]
    const at = links.indexOf(document.activeElement as HTMLAnchorElement)
    if (e.key === 'Escape' && open === title) {
      setOpen(null)
      ;(e.currentTarget.querySelector('button') as HTMLButtonElement | null)?.focus()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      openedBy.current = 'click'
      setOpen(title)
      // The card is drawn on the next frame; then its next link takes the focus.
      requestAnimationFrame(() => links[Math.min(at + 1, links.length - 1)]?.focus())
    } else if (e.key === 'ArrowUp' && at >= 0) {
      e.preventDefault()
      if (at === 0) (e.currentTarget.querySelector('button') as HTMLButtonElement | null)?.focus()
      else links[at - 1]?.focus()
    }
  }

  return (
    <nav className="header-nav" aria-label="Main">
      <ul className="header-nav-list" ref={list}>
        {nav.map((item) =>
          item.items?.length ? (
            <li
              key={item.title}
              className={`header-nav-item header-nav-item--folder${item.items.some((sub) => here(sub.href)) ? ' header-nav-item--active' : ''}${open === item.title ? ' is-open' : ''}`}
              onPointerEnter={onEnter(item.title)}
              onPointerLeave={onLeave}
              onKeyDown={onKeyDown(item.title)}
              onBlur={(e) => {
                // Tabbing out of a folder closes it.
                if (open === item.title && !e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(null)
              }}
            >
              <button type="button" className="header-nav-folder-title" aria-expanded={open === item.title} aria-controls={folderId(item.title)} onClick={() => onClick(item.title)}>
                <span className="header-nav-folder-title-text">{item.title}</span>
                <Caret className="header-nav-caret" />
              </button>
              <div className="header-nav-folder" id={folderId(item.title)}>
                <p className="header-nav-folder-label">{item.title}</p>
                <ul>
                  {item.items.map((sub) => {
                    const extra = MENU_PAGES[sub.href]
                    return (
                      <li key={sub.href} className={`header-nav-folder-item${here(sub.href) ? ' header-nav-folder-item--active' : ''}`}>
                        <a href={sub.href} aria-current={here(sub.href) ? 'page' : undefined} tabIndex={open === item.title ? undefined : -1}>
                          {extra && (
                            <img
                              className="header-nav-folder-thumb"
                              src={`${extra.picture}/100.webp`}
                              srcSet={`${extra.picture}/100.webp 100w, ${extra.picture}/300.webp 300w`}
                              sizes="48px"
                              alt=""
                              loading="lazy"
                              decoding="async"
                            />
                          )}
                          <span className="header-nav-folder-text">
                            <span className="header-nav-folder-item-content">{sub.title}</span>
                            {extra && <span className="header-nav-folder-line">{extra.line}</span>}
                          </span>
                        </a>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </li>
          ) : (
            <li key={item.title} className={`header-nav-item${here(item.href) ? ' header-nav-item--active' : ''}`}>
              <a href={item.href}>{item.title}</a>
            </li>
          ),
        )}
      </ul>
    </nav>
  )
}

/**
 * The phone menu, full screen in the original's colors: every page in one list, the folders opening in place (the one
 * holding the page the visitor is on starts open), and the "Log In" button at the bottom.
 */
function PhoneMenu({ open, here }: { open: boolean; here: (href: string) => boolean }) {
  const current = nav.find((item) => item.items?.some((sub) => here(sub.href)))?.title ?? null
  const [expanded, setExpanded] = useState<string | null>(current)
  const theme = (site.header.settings as { menuOverlayTheme?: string } | null)?.menuOverlayTheme ?? 'dark'

  return (
    <div className="header-menu" id="header-menu" data-theme={theme} aria-hidden={!open} inert={!open}>
      <nav className="header-menu-nav" aria-label="Main">
        <ul className="phone-nav">
          {nav.map((item) =>
            item.items?.length ? (
              <li key={item.title} className={`phone-nav-folder${expanded === item.title ? ' is-open' : ''}`}>
                <button
                  type="button"
                  className={`phone-nav-link${item.title === current ? ' phone-nav-link--active' : ''}`}
                  aria-expanded={expanded === item.title}
                  aria-controls={`phone-${folderId(item.title)}`}
                  onClick={() => setExpanded(expanded === item.title ? null : item.title)}
                >
                  <span>{item.title}</span>
                  <Caret className="phone-nav-caret" />
                </button>
                <div className="phone-nav-sub" id={`phone-${folderId(item.title)}`}>
                  <ul>
                    {item.items.map((sub) => (
                      <li key={sub.href}>
                        <a
                          href={sub.href}
                          className={`phone-nav-sublink${here(sub.href) ? ' phone-nav-sublink--active' : ''}`}
                          aria-current={here(sub.href) ? 'page' : undefined}
                          tabIndex={expanded === item.title ? undefined : -1}
                        >
                          {sub.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ) : (
              <li key={item.title}>
                <a href={item.href} className={`phone-nav-link${here(item.href) ? ' phone-nav-link--active' : ''}`} aria-current={here(item.href) ? 'page' : undefined}>
                  <span>{item.title}</span>
                </a>
              </li>
            ),
          )}
        </ul>
        <a className="phone-nav-cta" href={LOGIN_HREF}>
          Log In
        </a>
      </nav>
    </div>
  )
}
