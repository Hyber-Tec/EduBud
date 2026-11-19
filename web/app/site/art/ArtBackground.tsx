import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type RefObject } from 'react'
import type { Picture, SectionBackground } from '~/content/types'
import { focal, pictureSrc, srcSet } from '../Picture'
import { startArt } from './stage'

type Art = NonNullable<SectionBackground['art']>

/** Where a section's art is: running (drawn by the page), moving, paused, drawn at least once, or unable to start. */
export interface ArtState {
  running: boolean
  moves: boolean
  paused: boolean
  drawn: boolean
  /** It can't be drawn here (no WebGL, or a kind we don't draw). */
  failed: boolean
}

export interface ArtControl {
  node: RefObject<HTMLDivElement | null>
  /** The picture an effect on the section's picture draws. */
  picture: RefObject<HTMLImageElement | null>
  state: ArtState
  togglePaused(): void
}

/** Whether a section's art is an effect on its picture (parallax), which has no pause buttons, rather than generative art. */
export const isPictureEffect = (bg: SectionBackground | undefined): boolean => !!(bg?.image && bg.art)

/** Runs a section's art (stage.ts), for its background and its pause buttons. */
export function useArt(art: Art | undefined): ArtControl {
  const node = useRef<HTMLDivElement>(null)
  const picture = useRef<HTMLImageElement>(null)
  const [state, setState] = useState<ArtState>({ running: false, moves: false, paused: false, drawn: false, failed: false })
  const control = useRef<ReturnType<typeof startArt> | null>(null)
  const settings = art?.settings
  useEffect(() => {
    const box = node.current
    if (!box || !settings) return
    const img = picture.current
    let c: ReturnType<typeof startArt> | undefined
    const start = () => {
      if (c) return
      c = control.current = startArt(box, settings, {
        changed: (s) => setState((prev) => ({ ...prev, ...s, failed: !s.running })),
        drawn: () => setState((prev) => ({ ...prev, drawn: true })),
      })
    }
    // An effect on the section's picture is drawn from it: it starts once the picture has loaded, as the original's
    // does, and not at all for visitors who ask for less motion, who see the picture still.
    if (!img) start()
    else if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (img.complete && img.naturalWidth) start()
      else img.addEventListener('load', start)
    }
    return () => {
      img?.removeEventListener('load', start)
      c?.stop()
      if (control.current === c) control.current = null
    }
  }, [settings])
  return { node, picture, state, togglePaused: () => control.current?.togglePaused() }
}

/**
 * A section's animated art: drawn in the page, as the original's, in the box its code draws into.
 *
 * Generative art shows the picture of it we took until it's first drawn, and wherever it can't be (no WebGL, or a
 * kind we don't draw). An effect on the section's picture (`picture`) has the picture itself next to its box, as on
 * the original: hidden while the effect shows it (sections.css), and shown still wherever the effect can't be drawn.
 * Its sizes are the original's, so that the browser picks the same file, and the picture has the same size on the
 * page, which the effect fits to the section.
 */
export function ArtBackground({ art, picture, control }: { art: Art; picture?: Picture; control: ArtControl }) {
  if (picture)
    return (
      <div className="section-background-content">
        <img
          ref={control.picture}
          className="background-image-fx"
          src={pictureSrc(picture)}
          srcSet={srcSet(picture)}
          sizes="(max-width: 799px) 200vw, 100vw"
          width={picture.width || undefined}
          height={picture.height || undefined}
          alt=""
          data-image-focal-point={picture.focal?.join(',')}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          style={{ objectPosition: focal(picture), visibility: control.state.failed || !art.settings ? 'visible' : undefined }}
        />
        <div ref={control.node} className="section-background-canvas background-fx-canvas" />
      </div>
    )
  return (
    <>
      {!control.state.drawn && art.images.length > 0 && (
        <picture>
          {art.images
            .filter((i) => i.upTo)
            .map((i) => (
              <source key={i.src} media={`(max-width: ${i.upTo}px)`} srcSet={i.src} />
            ))}
          <img className="section-background-media" src={art.images[art.images.length - 1].src} alt="" loading="lazy" decoding="async" />
        </picture>
      )}
      {art.settings && (
        <div className="section-background-content">
          <div ref={control.node} className="section-background-canvas background-fx-canvas" />
        </div>
      )}
    </>
  )
}

/**
 * The art's round pause button, and its play button, as the original has them: only one shows at a time, and only
 * once the art runs and if it moves. Pausing one section's art pauses all, and the browser remembers it for the next
 * visit. The focus follows from one button to the other.
 */
export function PauseButtons({ control }: { control: ArtControl }) {
  const { running, moves, paused } = control.state
  const pause = useRef<HTMLButtonElement>(null)
  const play = useRef<HTMLButtonElement>(null)
  const focused = useRef<HTMLButtonElement | null>(null)
  const showPause = running && moves && !paused
  const showPlay = running && moves && paused
  useLayoutEffect(() => {
    if (focused.current === pause.current && showPlay) play.current?.focus()
    else if (focused.current === play.current && showPause) pause.current?.focus()
    focused.current = null
  }, [showPause, showPlay])
  const toggle = (e: MouseEvent<HTMLButtonElement>) => {
    focused.current = document.activeElement === e.currentTarget ? e.currentTarget : null
    control.togglePaused()
  }
  return (
    <>
      <button ref={pause} type="button" className={`background-pause-button${showPause ? ' visible' : ''}`} aria-label="Pause Background" onClick={toggle} />
      <button
        ref={play}
        type="button"
        className={`background-pause-button background-pause-button--paused${showPlay ? ' visible' : ''}`}
        aria-label="Play Background"
        onClick={toggle}
      />
    </>
  )
}
