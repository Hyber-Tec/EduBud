import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import type { InstagramBlock as Data, Picture } from '~/content/types'
import widgets from '~/content/widgets.json'
import { focal, pictureSrc, srcSet } from '../Picture'

/** A post of the feed, as scripts/capture/widgets.ts saved it: its picture, its caption, and for a video, Instagram's player. */
interface Post {
  kind: 'image' | 'video'
  picture: Picture
  description: string
  href?: string
  embed?: { src: string; width: number; height: number }
}
interface Feed {
  perRow: number
  aspectRatio: string
  gap: number
  lightbox: boolean
  posts: Post[]
}

type Vars = CSSProperties & Record<`--${string}`, string | number>

/** "3 / 4" as Squarespace sizes its tiles: the height is the width times the ratio rounded to four places. */
function tileRatio(ratio: string): string {
  const [w, h] = ratio.split('/').map(Number)
  return w && h ? `1 / ${(h / w).toFixed(4)}` : '1 / 1'
}

/**
 * The Instagram feed: Squarespace keeps a copy of each post and shows them as a grid of tiles (4 a row, 2 on phones);
 * a tile opens the post in a dark lightbox, a picture with its caption or Instagram's own player for a video.
 */
export function InstagramBlock({ block }: { block: Data }) {
  const feed = (widgets.instagram as unknown as Record<string, Feed>)[block.id]
  const [open, setOpen] = useState<number | null>(null)
  const posts = feed?.posts ?? []
  const vars: Vars = { '--ig-cols': feed?.perRow ?? 4, '--ig-gap': `${feed?.gap ?? 0}px`, '--ig-ratio': tileRatio(feed?.aspectRatio ?? '1 / 1') }
  const openAt = (i: number) => feed?.lightbox !== false && setOpen(i)
  return (
    <div className="block instagram-block">
      <div className="ig-grid" style={vars}>
        {posts.map((p, i) =>
          p.kind === 'video' ? (
            <div key={i} className="ig-slide">
              <div
                className="ig-opener ig-opener--video"
                role="button"
                tabIndex={0}
                onClick={() => openAt(i)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), openAt(i))}
              >
                <span className="visually-hidden">View fullsize</span>
                <TileImage picture={p.picture} alt="" />
                <span className="ig-play" aria-hidden="true">
                  <svg viewBox="0 0 48 48">
                    <path d="M8.5 10.6c0-.5.5-.8 1-.6l29.6 14.9c.5.3.5.9 0 1.2L9.5 41c-.5.2-1-.1-1-.6z" />
                  </svg>
                </span>
              </div>
            </div>
          ) : (
            <div key={i} className="ig-slide">
              <a
                className="ig-opener"
                href={pictureSrc(p.picture, 2500)}
                role="button"
                onClick={(e) => {
                  if (feed?.lightbox === false) return
                  e.preventDefault()
                  openAt(i)
                }}
              >
                <span className="visually-hidden">View fullsize</span>
                <TileImage picture={p.picture} alt={p.picture.alt} />
              </a>
            </div>
          ),
        )}
      </div>
      {open !== null && <Lightbox posts={posts} start={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

/** How far below the window a tile's picture starts to load, as the original's gallery measures it. */
const LOAD_AHEAD_PX = 200

/**
 * A tile's picture, loaded as the original's gallery loads it: only once it comes within 200px of the window, then
 * faded in over a second once it has arrived (widgets.css). So scrolling down, the tiles appear one row after another.
 * Without scripts, the picture in <noscript> shows instead.
 */
function TileImage({ picture, alt }: { picture: Picture; alt: string }) {
  const ref = useRef<HTMLImageElement>(null)
  const [near, setNear] = useState(false)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    // Watched: the tile (the picture takes no room until it has a file).
    const tile = ref.current?.parentElement
    if (!tile) return
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        setNear(true)
        io.disconnect()
      },
      { rootMargin: `0px 0px ${LOAD_AHEAD_PX}px 0px` },
    )
    io.observe(tile)
    return () => io.disconnect()
  }, [])
  // A picture already in the browser's cache may have loaded before React listened.
  useEffect(() => {
    if (near && ref.current?.complete && ref.current.naturalWidth) setLoaded(true)
  }, [near])
  const style = { objectPosition: focal(picture) }
  return (
    <>
      <img
        ref={ref}
        className="ig-img"
        data-loaded={loaded || undefined}
        src={near ? pictureSrc(picture) : undefined}
        srcSet={near ? srcSet(picture) : undefined}
        sizes={near ? 'auto, 100vw' : undefined}
        loading="lazy"
        decoding="async"
        alt={alt}
        width={picture.width || undefined}
        height={picture.height || undefined}
        style={style}
        onLoad={() => setLoaded(true)}
      />
      <noscript>
        <img className="ig-img ig-img--static" src={pictureSrc(picture)} alt={alt} style={style} />
      </noscript>
    </>
  )
}

/** Where a picture or a player sits inside the lightbox's frame: as large as fits, centred. */
interface Fit {
  left: number
  top: number
  width: number
  height: number
}
function fit(frameW: number, frameH: number, w: number, h: number): Fit {
  // The side that fills the frame is a whole number of pixels, as the original's.
  const byWidth = frameW / w <= frameH / h
  const width = byWidth ? Math.floor(frameW) : (Math.floor(frameH) * w) / h
  const height = byWidth ? (Math.floor(frameW) * h) / w : Math.floor(frameH)
  return { left: (frameW - width) / 2, top: (frameH - height) / 2, width, height }
}

/**
 * The lightbox's fades, as the original's: the dark backdrop in 0.3 s (in and out), a change of post in 0.65 s; on
 * closing, the post and the buttons fade out over 0.6 s, so they linger a moment over the page once the backdrop has
 * gone (widgets.css).
 */
const CLOSE_MS = 600
const ARROW_IDLE_MS = 500

/**
 * The original's lightbox, drawn in our code: a near-black backdrop (95%), the post as large as fits inside a 2% margin,
 * its caption along the picture's bottom, a close button, and arrows that show on the side the pointer moves on.
 * Esc closes, the arrow keys step through the posts; on touch screens a swipe steps, and the dot shows the caption.
 */
function Lightbox({ posts, start, onClose }: { posts: Post[]; start: number; onClose: () => void }) {
  const [index, setIndex] = useState(start)
  const [phase, setPhase] = useState<'opening' | 'open' | 'closing'>('opening')
  const [arrow, setArrow] = useState<null | 'prev' | 'next'>(null)
  const [touch, setTouch] = useState(false)
  const [caption, setCaption] = useState(false)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const arrowTimer = useRef<number | undefined>(undefined)
  const swipe = useRef<{ x: number; y: number } | null>(null)

  const close = useCallback(() => {
    setPhase('closing')
    window.setTimeout(onClose, CLOSE_MS)
  }, [onClose])
  const step = useCallback((by: number) => setIndex((i) => (i + by + posts.length) % posts.length), [posts.length])

  useLayoutEffect(() => {
    const measure = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    measure()
    setTouch(matchMedia('(hover: none)').matches)
    window.addEventListener('resize', measure)
    // The page under it stays still while it's open.
    const body = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setPhase('open')))
    root.current?.focus()
    return () => {
      window.removeEventListener('resize', measure)
      document.body.style.overflow = body
      cancelAnimationFrame(raf)
      window.clearTimeout(arrowTimer.current)
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowLeft') step(-1)
      else if (e.key === 'ArrowRight') step(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close, step])

  if (!size) return null
  // The frame: 2% of the window in from each side.
  const frame = { left: size.w * 0.02, top: size.h * 0.02, w: size.w * 0.96, h: size.h * 0.96 }
  const vars: Vars = { '--lb-left': `${frame.left}px`, '--lb-top': `${frame.top}px`, '--lb-w': `${frame.w}px`, '--lb-h': `${frame.h}px` }

  return createPortal(
    <div
      ref={root}
      className="ig-lightbox"
      data-phase={phase}
      data-touch={touch || undefined}
      role="dialog"
      aria-modal="true"
      aria-label="Instagram post"
      tabIndex={-1}
      style={vars}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse') return
        setArrow(e.clientX < size.w / 2 ? 'prev' : 'next')
        window.clearTimeout(arrowTimer.current)
        arrowTimer.current = window.setTimeout(() => setArrow(null), ARROW_IDLE_MS)
      }}
      onPointerDown={(e) => {
        if (e.pointerType !== 'mouse') swipe.current = { x: e.clientX, y: e.clientY }
      }}
      onPointerUp={(e) => {
        const s = swipe.current
        swipe.current = null
        if (!s) return
        const dx = e.clientX - s.x
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - s.y)) step(dx < 0 ? 1 : -1)
      }}
      onKeyDown={(e: ReactKeyboardEvent) => e.key === 'Tab' && trapFocus(e, root.current)}
    >
      <div className="ig-lb-overlay" />
      <div className="ig-lb-slides">
        {posts.map((p, i) => (
          <Slide key={i} post={p} active={i === index} frame={frame} touch={touch} caption={caption} />
        ))}
      </div>
      <button type="button" className="ig-lb-control ig-lb-close" aria-label="Close" onClick={close}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6.1 6.1l11.8 11.8M17.9 6.1L6.1 17.9" />
        </svg>
      </button>
      {!touch && (
        <>
          <button type="button" className="ig-lb-control ig-lb-arrow ig-lb-prev" data-show={arrow === 'prev' || undefined} aria-label="Previous Item" onClick={() => step(-1)}>
            <svg viewBox="0 0 44 44" aria-hidden="true">
              <path d="M27.4 13.1L17 23.1l10.4 10" />
            </svg>
          </button>
          <button type="button" className="ig-lb-control ig-lb-arrow ig-lb-next" data-show={arrow === 'next' || undefined} aria-label="Next Item" onClick={() => step(1)}>
            <svg viewBox="0 0 44 44" aria-hidden="true">
              <path d="M16.6 13.1L27 23.1l-10.4 10" />
            </svg>
          </button>
        </>
      )}
      {touch && posts[index]?.kind === 'image' && posts[index].description && (
        <button type="button" className="ig-lb-meta-trigger" aria-label="Toggle Caption" onClick={() => setCaption((c) => !c)}>
          •
        </button>
      )}
    </div>,
    document.body,
  )
}

/** One post in the lightbox: the picture with its caption, or Instagram's player for a video (only while it's shown). */
function Slide({ post, active, frame, touch, caption }: { post: Post; active: boolean; frame: { w: number; h: number }; touch: boolean; caption: boolean }) {
  const isVideo = post.kind === 'video' && post.embed
  const box = isVideo ? fit(frame.w, frame.h, post.embed!.width, post.embed!.height) : fit(frame.w, frame.h, post.picture.width || 1, post.picture.height || 1)
  const place: CSSProperties = { left: box.left, top: box.top, width: box.width, height: box.height }
  // The caption runs along the picture's bottom edge, a pixel past it on the right and below, as the original's does.
  const meta: CSSProperties = touch
    ? {}
    : { left: box.left, right: Math.floor(frame.w - box.left - box.width) - 1, bottom: Math.floor(box.top) - 1 }
  const text = post.description.replace(/\s+/g, ' ').trim()
  return (
    <div className="ig-lb-slide" data-active={active || undefined} aria-hidden={!active}>
      <div className="ig-lb-frame">
        {isVideo ? (
          active && (
            <iframe
              className="ig-lb-media"
              style={place}
              src={`${post.embed!.src}?autoplay=1`}
              title="Instagram post"
              allow="autoplay; encrypted-media; picture-in-picture"
              scrolling="no"
              allowFullScreen
            />
          )
        ) : (
          <>
            <img className="ig-lb-media" style={place} src={pictureSrc(post.picture, box.width * (typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1))} alt={post.picture.alt} draggable={false} />
            {text && (!touch || caption) && (
              <div className="ig-lb-meta" data-touch={touch || undefined} style={meta}>
                {text}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/** Keeps the keyboard inside the lightbox while it's open. */
function trapFocus(e: ReactKeyboardEvent, root: HTMLElement | null) {
  if (!root) return
  const items = [...root.querySelectorAll<HTMLElement>('button, [href], iframe, [tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null)
  if (!items.length) return
  const first = items[0]
  const last = items[items.length - 1]
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}
