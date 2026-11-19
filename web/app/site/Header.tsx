import { useEffect, useState } from 'react'
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

  useEffect(() => {
    let last = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      setHidden(y > last && y > 120)
      last = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('menu-open', menuOpen)
  }, [menuOpen])

  return (
    <header className={`site-header${hidden && !menuOpen ? ' site-header--hidden' : ''}${menuOpen ? ' site-header--menu-open' : ''}`} data-theme="">
      <div className="header-inner">
        <a className="header-logo" href={site.header.logoHref || '/'}>
          <img src={pictureSrc(logo, 1500)} srcSet={srcSet(logo)} sizes="100px" alt={logo.alt} />
        </a>
        <nav className="header-nav" aria-label="Main">
          <ul className="header-nav-list">
            {nav.map((item) =>
              item.items?.length ? (
                <li key={item.title} className="header-nav-item header-nav-item--folder">
                  <a className="header-nav-folder-title" href={folderHref(item.title)}>
                    {item.title}
                  </a>
                  <div className="header-nav-folder">
                    <ul>
                      {item.items.map((sub) => (
                        <li key={sub.href} className="header-nav-folder-item">
                          <a href={sub.href}>{sub.title}</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              ) : (
                <li key={item.title} className="header-nav-item">
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
                    className="header-menu-link header-menu-link--folder"
                    onClick={(e) => {
                      e.preventDefault()
                      setFolder(item.title)
                    }}
                  >
                    <span className="visually-hidden">Folder: </span>
                    {item.title}
                    <Chevron direction="right" />
                  </a>
                ) : (
                  <a href={item.href} className="header-menu-link">
                    {item.title}
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
