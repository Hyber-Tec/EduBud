import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type RefObject } from 'react'
import type { SectionBackground } from '~/content/types'
import { startArt } from './stage'

type Art = NonNullable<SectionBackground['art']>

/** Where a section's art is: running (drawn by the page), moving, paused, and drawn at least once. */
export interface ArtState {
  running: boolean
  moves: boolean
  paused: boolean
  drawn: boolean
}

export interface ArtControl {
  node: RefObject<HTMLDivElement | null>
  state: ArtState
  togglePaused(): void
}

/** Runs a section's art (stage.ts), for its background and its pause buttons. */
export function useArt(art: Art | undefined): ArtControl {
  const node = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<ArtState>({ running: false, moves: false, paused: false, drawn: false })
  const control = useRef<ReturnType<typeof startArt> | null>(null)
  const settings = art?.settings
  useEffect(() => {
    if (!node.current || !settings) return
    const c = startArt(node.current, settings, {
      changed: (s) => setState((prev) => ({ ...prev, ...s })),
      drawn: () => setState((prev) => ({ ...prev, drawn: true })),
    })
    control.current = c
    return () => {
      c.stop()
      if (control.current === c) control.current = null
    }
  }, [settings])
  return { node, state, togglePaused: () => control.current?.togglePaused() }
}

/**
 * A section's animated art: drawn in the page, as the original's, in the box its code draws into. Until it's first
 * drawn, and wherever it can't be (no WebGL, or a kind we don't draw), the picture of it we took.
 */
export function ArtBackground({ art, control }: { art: Art; control: ArtControl }) {
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
