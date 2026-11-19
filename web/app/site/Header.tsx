import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import site from '~/content/site.json'
import type { Picture } from '~/content/types'
import { pictureSrc, srcSet } from './Picture'

interface NavItem {
  title: string
  href: string
  items?: { title: string; href: string }[]
}

const nav = site.header.nav as NavItem[]
const logo = site.header.logo as unknown as Picture

/** The phone menu's thin arrowhead (the original's "open arrow head", 0.5px). */
function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg className={`chevron chevron--${direction}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d={direction === 'right' ? 'M9 4l7 8-7 8' : 'M15 4l-7 8 7 8'} fill="none" stroke="currentColor" strokeWidth="0.5" strokeLinecap="square" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** A folder's own address (`/learning-center`), which sends visitors to its first page. */
const folderHref = (title: string) => '/' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-')

/**
 * The site's header: the logo, the menu with its folders (drop-downs), and on phones a button that opens the menu
 * full screen. It hides while the page scrolls down and comes back when it scrolls up, as the original's does.
 */
export function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [folder, setFolder] = useState<string | null>(null)
  const [hidden, setHidden] = useState(false)
  const [shrink, setShrink] = useState(false)
  const header = useRef<HTMLElement>(null)
  const { pathname } = useLocation()
  const here = (href: string) => href !== '/' && (pathname === href || pathname.startsWith(href + '/'))

  // The original's "scroll back" header: once the page has scrolled (more than 10px), scrolling down hides it, and
  // scrolling up brings it back after 200px without a pause of more than half a second. At the top, or while
  // something in it has the keyboard's focus, it shows. While scrolled it "shrinks" (shorter on phones).
  useEffect(() => {
    let last = window.scrollY
    let distance = 0
    let then = 0
    let shrinkTimer = 0
    const onScroll = () => {
      const y = window.scrollY
      const scrolled = y > 10
      if (!scrolled || header.current?.matches(':focus-within')) setHidden(false)
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
        <nav className="header-nav" aria-label="Main">
          <ul className="header-nav-list">
            {nav.map((item) =>
              item.items?.length ? (
                <li key={item.title} className={`header-nav-item header-nav-item--folder${item.items.some((sub) => here(sub.href)) ? ' header-nav-item--active' : ''}`}>
                  {/* A folder's title opens its list (on hover, or from the keyboard); it isn't a link, as on the original. */}
                  <button type="button" className="header-nav-folder-title" aria-controls={`folder${folderHref(item.title).replace('/', '-')}`}>
                    <span className="header-nav-folder-title-text">{item.title}</span>
                  </button>
                  <div className="header-nav-folder" id={`folder${folderHref(item.title).replace('/', '-')}`}>
                    <ul>
                      {item.items.map((sub) => (
                        <li key={sub.href} className={`header-nav-folder-item${here(sub.href) ? ' header-nav-folder-item--active' : ''}`}>
                          <a href={sub.href}>
                            <span className="header-nav-folder-item-content">{sub.title}</span>
                          </a>
                        </li>
                      ))}
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
        <button
          type="button"
          className={`header-burger${menuOpen ? ' header-burger--open' : ''}`}
          aria-label={menuOpen ? 'Close Menu' : 'Open Menu'}
          aria-expanded={menuOpen}
          onClick={() => {
            setMenuOpen(!menuOpen)
            setFolder(null)
          }}
        >
          <span className="burger-box">
            <span className="burger-line burger-line--top" />
            <span className="burger-line burger-line--bottom" />
          </span>
        </button>
      </div>

      <div className="header-menu" data-theme={(site.header.settings as { menuOverlayTheme?: string } | null)?.menuOverlayTheme ?? 'dark'} aria-hidden={!menuOpen}>
        <div className={`header-menu-nav${folder ? ' header-menu-nav--folder-open' : ''}`}>
          <ul className="header-menu-list header-menu-list--root">
            {nav.map((item) => (
              <li key={item.title}>
                {item.items?.length ? (
                  <a
                    href={folderHref(item.title)}
                    className={`header-menu-link header-menu-link--folder${item.items.some((sub) => here(sub.href)) ? ' header-menu-link--active' : ''}`}
                    onClick={(e) => {
                      e.preventDefault()
                      setFolder(item.title)
                    }}
                  >
                    <span className="visually-hidden">Folder: </span>
                    <span className="header-menu-link-text">{item.title}</span>
                    <Chevron direction="right" />
                  </a>
                ) : (
                  <a href={item.href} className={`header-menu-link${here(item.href) ? ' header-menu-link--active' : ''}`}>
                    <span className="header-menu-link-text">{item.title}</span>
                  </a>
                )}
              </li>
            ))}
          </ul>
          {nav
            .filter((item) => item.items?.length)
            .map((item) => (
              <ul key={item.title} className={`header-menu-list header-menu-list--folder${folder === item.title ? ' is-active' : ''}`}>
                <li>
                  <a
                    href="/"
                    className="header-menu-link header-menu-link--back"
                    onClick={(e) => {
                      e.preventDefault()
                      setFolder(null)
                    }}
                  >
                    <Chevron direction="left" />
                    Back
                  </a>
                </li>
                {item.items!.map((sub) => (
                  <li key={sub.href}>
                    <a href={sub.href} className="header-menu-link">
                      {sub.title}
                    </a>
                  </li>
                ))}
              </ul>
            ))}
        </div>
      </div>
    </header>
  )
}
