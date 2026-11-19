import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { MapBlock as Data } from '~/content/types'
import widgets from '~/content/widgets.json'

/** The map's place and how the original draws it, as scripts/capture/widgets.ts read them. */
interface MapWidget {
  lat: number
  lng: number
  zoom: number
  place: string[]
  appear?: { scale: number; opacity: number; duration: number; delay: number; replay: boolean }
}

/**
 * The map: Google's map of the same place at the same zoom, with its red pin in the middle. The original draws it with
 * Google's map code and Squarespace's own key, without controls; with no key of ours, this is Google's keyless embed,
 * which adds a satellite-view thumbnail and a full-screen button, and scrolls the page on the wheel instead of zooming
 * (ctrl + wheel zooms). Like the original, it grows in from nothing when it first scrolls into view (the block's
 * "appear" animation, a spring: widgets.css).
 */
export function MapBlock({ block }: { block: Data }) {
  const w = (widgets.map as Record<string, MapWidget>)[block.id]
  const lat = w?.lat ?? block.lat
  const lng = w?.lng ?? block.lng
  const zoom = w?.zoom ?? block.zoom
  const appear = w?.appear && w.appear.scale !== 1 ? w.appear : undefined
  const ref = useRef<HTMLDivElement>(null)
  // "static": drawn as is; "waiting": hidden until it scrolls into view; "shown": grown in.
  const [state, setState] = useState<'static' | 'pending' | 'waiting' | 'shown'>(appear ? 'pending' : 'static')

  useEffect(() => {
    // Watched: the block's place on the grid, which keeps its size while the map itself is shrunk to nothing.
    const el = ref.current?.parentElement ?? ref.current
    if (!appear || !el) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setState('static')
      return
    }
    // Already scrolled past (a reload halfway down the page): no animation.
    if (el.getBoundingClientRect().bottom < 0) {
      setState('static')
      return
    }
    setState('waiting')
    // It appears once half of it is in view (the original's "middle" appear point).
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setState('shown')
          io.disconnect()
        }
      },
      { threshold: 0.5 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [appear])

  return (
    <div
      ref={ref}
      className="block map-block"
      data-appear={state}
      style={appear ? ({ '--appear-scale': appear.scale, '--appear-opacity': appear.opacity, '--appear-delay': `${appear.delay}s` } as CSSProperties) : undefined}
    >
      <div className="map-frame">
        <iframe
          title={w?.place[0] ? `Map of ${w.place[0]}` : 'Map'}
          src={`https://maps.google.com/maps?q=${lat},${lng}&z=${zoom}&hl=en&output=embed`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>
    </div>
  )
}
