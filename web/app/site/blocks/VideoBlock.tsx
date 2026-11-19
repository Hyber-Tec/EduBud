import { useEffect, useRef, useState, type CSSProperties, type HTMLAttributeReferrerPolicy, type KeyboardEvent, type PointerEvent } from 'react'
import type { VideoBlock as Data } from '~/content/types'
import widgets from '~/content/widgets.json'

/** What scripts/capture/widgets.ts read from the original's video blocks. */
type VideoWidget =
  | { provider: 'youtube'; src: string; title: string; allow: string; referrerPolicy?: string }
  | { provider: 'native'; duration: number; aspectRatio: number }

/** A YouTube video is YouTube's own player, as on the original; a video Squarespace hosted gets our player. */
export function VideoBlock({ block }: { block: Data }) {
  const w = (widgets.video as Record<string, VideoWidget>)[block.id]
  if (block.provider === 'native' && block.file) {
    const native = w?.provider === 'native' ? w : undefined
    return (
      <div className="block video-block">
        <Player
          src={block.file.src}
          poster={block.file.src.replace(/video\.mp4$/, 'poster.jpg')}
          duration={native?.duration ?? 0}
          aspectRatio={native?.aspectRatio ?? block.file.width / block.file.height}
        />
      </div>
    )
  }
  const yt = w?.provider === 'youtube' ? w : undefined
  return (
    <div className="block video-block">
      <div className="video-frame" style={{ paddingBottom: `${block.ratio}%` }}>
        <iframe
          src={yt?.src ?? `https://www.youtube.com/embed/${block.videoId}?feature=oembed`}
          title={yt?.title ?? decode(block.title)}
          allow={yt?.allow ?? 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'}
          referrerPolicy={(yt?.referrerPolicy ?? 'strict-origin-when-cross-origin') as HTMLAttributeReferrerPolicy}
          allowFullScreen
          loading="lazy"
        />
      </div>
    </div>
  )
}

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')

/** mm:ss, as the original's player writes it (h:mm:ss past an hour). */
function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds || 0))
  const two = (n: number) => String(n).padStart(2, '0')
  const h = Math.floor(s / 3600)
  return h ? `${h}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}` : `${two(Math.floor(s / 60))}:${two(s % 60)}`
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
/** While it plays, the controls hide this long after the pointer last moved. */
const HIDE_MS = 2000
/** The arrow keys skip this far. */
const SKIP_S = 10

type Vars = CSSProperties & Record<`--${string}`, string | number>

/**
 * The player for videos Squarespace hosted, drawn like the original's: the first frame with a round play button, and
 * controls along the bottom (time, volume, speed, full screen, the progress bar) that hide while the video plays. Its
 * sizes follow the player's width (container queries in widgets.css), as the original's do.
 */
function Player({ src, poster, duration, aspectRatio }: { src: string; poster: string; duration: number; aspectRatio: number }) {
  const root = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const hideTimer = useRef<number | undefined>(undefined)
  const indicatorTimer = useRef<number | undefined>(undefined)
  const [started, setStarted] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [time, setTime] = useState(0)
  const [length, setLength] = useState(duration)
  const [buffered, setBuffered] = useState(0)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [menu, setMenu] = useState<null | 'home' | 'speed'>(null)
  const [speed, setSpeed] = useState(1)
  const [fullscreen, setFullscreen] = useState(false)
  const [hoverAt, setHoverAt] = useState<number | null>(null)
  const [indicator, setIndicator] = useState<null | 'backward' | 'forward'>(null)
  const [touch, setTouch] = useState(false)

  /** How much of the video has loaded, for the progress bar's lighter part. */
  function syncLoaded(v: HTMLVideoElement) {
    if (v.duration) {
      setLength(v.duration)
      if (v.buffered.length) setBuffered((100 * v.buffered.end(v.buffered.length - 1)) / v.duration)
    }
  }

  useEffect(() => {
    setTouch(matchMedia('(hover: none)').matches)
    // The video starts loading with the page, before this code runs: catch up with what it has done.
    if (video.current) syncLoaded(video.current)
    const onFs = () => setFullscreen(document.fullscreenElement === root.current)
    document.addEventListener('fullscreenchange', onFs)
    return () => {
      document.removeEventListener('fullscreenchange', onFs)
      window.clearTimeout(hideTimer.current)
      window.clearTimeout(indicatorTimer.current)
    }
  }, [])

  /** Show the controls; while playing, hide them again once the pointer rests. */
  function wake() {
    setHidden(false)
    window.clearTimeout(hideTimer.current)
    if (video.current && !video.current.paused) hideTimer.current = window.setTimeout(() => setHidden(true), HIDE_MS)
  }

  function toggle() {
    const v = video.current
    if (!v) return
    if (v.paused || v.ended) void v.play().catch(() => undefined)
    else v.pause()
  }

  function skip(by: number) {
    const v = video.current
    if (!v) return
    v.currentTime = Math.min(Math.max(0, v.currentTime + by), v.duration || length)
    setIndicator(by < 0 ? 'backward' : 'forward')
    window.clearTimeout(indicatorTimer.current)
    indicatorTimer.current = window.setTimeout(() => setIndicator(null), 600)
  }

  function onKey(e: KeyboardEvent) {
    const v = video.current
    if (!v || (e.target as HTMLElement).closest('input, .vp-menu')) return
    const key = e.key.toLowerCase()
    if (key === ' ' || key === 'k') toggle()
    else if (key === 'arrowleft') skip(-SKIP_S)
    else if (key === 'arrowright') skip(SKIP_S)
    else if (key === 'arrowup') v.volume = Math.min(1, v.volume + 0.1)
    else if (key === 'arrowdown') v.volume = Math.max(0, v.volume - 0.1)
    else if (key === 'm') v.muted = !v.muted
    else if (key === 'f') toggleFullscreen()
    else return
    e.preventDefault()
    wake()
  }

  function toggleFullscreen() {
    const el = root.current as (HTMLDivElement & { webkitRequestFullscreen?: () => void }) | null
    const v = video.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null
    if (document.fullscreenElement) void document.exitFullscreen()
    else if (el?.requestFullscreen) void el.requestFullscreen().catch(() => v?.webkitEnterFullscreen?.())
    else v?.webkitEnterFullscreen?.()
  }

  /** A click on the picture plays or pauses, as the original's; a tap while it plays first brings the controls back. */
  function onSurface(e: PointerEvent) {
    if ((e.target as HTMLElement).closest('.vp-controls, .vp-play')) return
    if (touch && playing && hidden) {
      wake()
      return
    }
    toggle()
  }

  const progress = length ? (100 * time) / length : 0
  const vars: Vars = { aspectRatio: String(aspectRatio) }
  return (
    <div
      ref={root}
      className="vp"
      style={vars}
      data-started={started || undefined}
      data-playing={playing || undefined}
      data-hidden={(playing && hidden) || undefined}
      data-touch={touch || undefined}
      data-fullscreen={fullscreen || undefined}
      tabIndex={0}
      onPointerMove={(e) => e.pointerType === 'mouse' && wake()}
      onPointerLeave={() => playing && !menu && setHidden(true)}
      onPointerUp={onSurface}
      onKeyDown={onKey}
    >
      <video
        ref={video}
        className="vp-video"
        src={src}
        preload="auto"
        playsInline
        onPlay={() => {
          setPlaying(true)
          setStarted(true)
          setMenu(null)
          setHidden(true)
        }}
        onPause={() => {
          setPlaying(false)
          setHidden(false)
          window.clearTimeout(hideTimer.current)
        }}
        onEnded={() => {
          setPlaying(false)
          setHidden(false)
        }}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => syncLoaded(e.currentTarget)}
        onProgress={(e) => syncLoaded(e.currentTarget)}
        onCanPlayThrough={(e) => syncLoaded(e.currentTarget)}
        onVolumeChange={(e) => {
          setMuted(e.currentTarget.muted)
          setVolume(e.currentTarget.volume)
        }}
        onRateChange={(e) => setSpeed(e.currentTarget.playbackRate)}
      />
      <div className="vp-poster" style={{ backgroundImage: `url(${poster})` }} />
      <button type="button" className="vp-play" aria-label={playing ? 'Pause' : 'Play'} onClick={toggle}>
        <svg viewBox="0 0 30 30" aria-hidden="true">
          {playing ? <path d={ICON.pause} /> : <path d={ICON.play} stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />}
        </svg>
      </button>
      <div className="vp-indicators" aria-hidden="true">
        <span className="vp-indicator vp-indicator--backward" data-show={indicator === 'backward' || undefined}>
          <svg viewBox="0 0 30 30">
            <path d={ICON.backward} />
          </svg>
        </span>
        <span className="vp-indicator vp-indicator--forward" data-show={indicator === 'forward' || undefined}>
          <svg viewBox="0 0 30 30">
            <path d={ICON.forward} />
          </svg>
        </span>
      </div>
      <div className="vp-controls">
        <div className="vp-time" aria-label="Current time">
          {clock(time)}
        </div>
        <div className="vp-time vp-time--duration" aria-label="Duration">
          {clock(length)}
        </div>
        <div className="vp-volume">
          <button type="button" className="vp-button" aria-label={muted ? 'Unmute' : 'Mute'} onClick={() => video.current && (video.current.muted = !video.current.muted)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d={muted || volume === 0 ? ICON.muted : ICON.volume} />
            </svg>
          </button>
          <input
            type="range"
            className="vp-range vp-range--volume"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            aria-label="Volume"
            style={{ '--value': `${(muted ? 0 : volume) * 100}%` } as Vars}
            onChange={(e) => {
              const v = video.current
              if (!v) return
              v.volume = Number(e.target.value)
              v.muted = Number(e.target.value) === 0
            }}
          />
        </div>
        <div className="vp-menu-wrap">
          <button type="button" className="vp-button vp-button--settings" aria-label="Settings" aria-haspopup="true" aria-expanded={menu !== null} onClick={() => setMenu(menu ? null : 'home')}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d={ICON.settings} />
              <path d={ICON.settingsTeeth} fill="currentColor" stroke="none" />
            </svg>
          </button>
          {menu && (
            <div className="vp-menu" role="menu">
              {menu === 'home' ? (
                <button type="button" role="menuitem" className="vp-menu-item vp-menu-item--forward" onClick={() => setMenu('speed')}>
                  <span>Speed</span>
                  <span className="vp-menu-value">{speed === 1 ? 'Normal' : `${speed}x`}</span>
                </button>
              ) : (
                <>
                  <button type="button" className="vp-menu-item vp-menu-item--back" onClick={() => setMenu('home')}>
                    Speed
                  </button>
                  {SPEEDS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      role="menuitemradio"
                      aria-checked={speed === r}
                      className="vp-menu-item vp-menu-item--radio"
                      onClick={() => {
                        if (video.current) video.current.playbackRate = r
                        setMenu(null)
                      }}
                    >
                      {r === 1 ? 'Normal' : `${r}x`}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
        <button type="button" className="vp-button" aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} onClick={toggleFullscreen}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={fullscreen ? ICON.exitFullscreen : ICON.fullscreen} />
          </svg>
        </button>
        <div
          className="vp-progress"
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            setHoverAt(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)))
          }}
          onPointerLeave={() => setHoverAt(null)}
        >
          <input
            type="range"
            className="vp-range vp-range--seek"
            min={0}
            max={100}
            step={0.01}
            value={progress}
            aria-label="Seek"
            style={{ '--value': `${progress}%` } as Vars}
            onChange={(e) => {
              const v = video.current
              if (v && (v.duration || length)) v.currentTime = (Number(e.target.value) / 100) * (v.duration || length)
            }}
          />
          <progress className="vp-buffer" max={100} value={buffered} />
          <span className="vp-tooltip" data-show={hoverAt !== null || undefined} style={{ left: `${(hoverAt ?? 0) * 100}%` }}>
            {clock((hoverAt ?? 0) * length)}
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * Our own drawings of the player's icons, after the original's: a 30-unit box for the round buttons (filled), 24 for
 * the controls (thin lines, widgets.css draws them with a 1.5 px stroke).
 */
const ICON = {
  // A triangle with rounded corners (its 2-unit stroke): 13 by 15.6 units, a little right of centre.
  play: 'M11.1 8.2 22.1 15 11.1 21.8z',
  pause: 'M7.5 6.4h5v17.2h-5zM17.5 6.4h5v17.2h-5z',
  backward: 'M14 9.5v11l-7.5-5.5zM23 9.5v11l-7.5-5.5z',
  forward: 'M7 9.5v11l7.5-5.5zM16 9.5v11l7.5-5.5z',
  // A speaker (its box and cone) and two waves.
  volume: 'M2.25 9.25h5v6.5h-5zM7.25 9.25 14.5 4.25v16l-7.25-4.5M17.5 10.5a1.85 1.85 0 0 1 0 3.5M17.5 6.75a5.56 5.56 0 0 1 0 11',
  muted: 'M2.25 9.25h5v6.5h-5zM7.25 9.25 14.5 4.25v16l-7.25-4.5M16.75 9.75l4.5 4.5M21.25 9.75l-4.5 4.5',
  // A ring with eight short teeth (the teeth are filled).
  settings: 'M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0z',
  settingsTeeth:
    'M11 3h2v2.75h-2zM11 18.25h2V21h-2zM3 11h2.75v2H3zM18.25 11H21v2h-2.75zM18.71 6.7 17.3 5.29l-1.27 1.27 1.41 1.41zM5.29 6.7 6.7 5.29l1.27 1.27-1.41 1.41zM18.71 17.3l-1.41 1.41-1.27-1.27 1.41-1.41zM5.29 17.3l1.41 1.41 1.27-1.27-1.41-1.41z',
  fullscreen: 'M4.8 10V4.8H10M14 4.8h5.2V10M19.2 14v5.2H14M10 19.2H4.8V14',
  exitFullscreen: 'M10 4.8V10H4.8M14 4.8V10h5.2M19.2 14H14v5.2M4.8 14H10v5.2',
}
