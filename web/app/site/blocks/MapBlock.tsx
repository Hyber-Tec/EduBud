import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { MapBlock as Data } from '~/content/types'
import widgets from '~/content/widgets.json'

/** The map's place and how the original draws it, as scripts/capture/widgets.ts read them. */
interface MapWidget {
  lat: number
  lng: number
  zoom: number
  /** The place's name, its two address lines and its country. */
  place: string[]
  /** The original's map style setting: 1 is Google's own look (the only one this site uses). */
  style?: number
  controls?: boolean
  labels?: boolean
  terrain?: boolean
  appear?: { scale: number; opacity: number; duration: number; delay: number; replay: boolean }
}

/** EduBud's Google Maps key (a browser key, limited to EduBud's addresses), given to builds that deploy to them. */
const KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined

/**
 * The map, drawn as the original draws it: Google's map code (version 3, in English for the US), the same place and
 * zoom, Google's own look with its labels, no controls, the wheel zooming it, and Google's red pin dropping in on the
 * place; a click on the pin opens Google Maps there. Without a key (a preview build), Google's keyless embed of the
 * same place stands in. Like the original, it grows in from nothing when it first scrolls into view (the block's
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
        {KEY && w ? (
          <GoogleMap widget={w} lat={lat} lng={lng} zoom={zoom} />
        ) : (
          <iframe
            title={w?.place[0] ? `Map of ${w.place[0]}` : 'Map'}
            src={`https://maps.google.com/maps?q=${lat},${lng}&z=${zoom}&hl=en&output=embed`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        )}
      </div>
    </div>
  )
}

/* The parts of Google's map code used here (it isn't typed in this project: it's loaded from Google at run time). */
interface GoogleMaps {
  Map: new (el: HTMLElement, options: object) => { setOptions(o: object): void; getZoom(): number }
  Marker: new (options: object) => { setIcon(icon: null): void; getPosition(): { toUrlValue(): string } }
  Animation: { DROP: unknown }
  MapTypeId: { ROADMAP: unknown; TERRAIN: unknown }
  event: { addListener(target: unknown, name: string, fn: () => void): void }
}

let loading: Promise<GoogleMaps> | null = null

/** Loads Google's map code once per page, as the original asks for it. */
function loadGoogleMaps(): Promise<GoogleMaps> {
  loading ??= new Promise((resolve, reject) => {
    const timeout = window.setTimeout(reject, 30_000)
    const callback = '__edubudMapsLoaded'
    ;(window as unknown as Record<string, () => void>)[callback] = () => {
      window.clearTimeout(timeout)
      resolve((window as unknown as { google: { maps: GoogleMaps } }).google.maps)
    }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?v=3&callback=${callback}&key=${KEY}&language=en&region=US`
    script.async = true
    document.head.appendChild(script)
  })
  return loading
}

/** The map itself, with the original's options (website.components.map's "Original" style, labels shown). */
function GoogleMap({ widget, lat, lng, zoom }: { widget: MapWidget; lat: number; lng: number; zoom: number }) {
  const el = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let gone = false
    loadGoogleMaps()
      .then((maps) => {
        const node = el.current
        if (gone || !node) return
        const [title, line1, line2, country] = widget.place
        // The pin's title and link: "730 Peachtree Industrial Boulevard Suwanee, GA, 30024, United States".
        const address = line1 || line2 ? `${line1} ${line2}${country ? `, ${country}` : ''}` : `${lat},${lng}`
        const controls = widget.controls ?? false
        const map = new maps.Map(node, { zoom, center: { lat, lng }, draggable: true, scrollwheel: true, disableDefaultUI: true })
        map.setOptions({
          mapTypeControl: false,
          mapTypeId: widget.terrain ? maps.MapTypeId.TERRAIN : maps.MapTypeId.ROADMAP,
          overviewMapControl: false,
          panControl: controls,
          scaleControl: controls,
          streetViewControl: false,
          // "Original": Google's own look, its labels hidden then shown again when the labels setting is on.
          styles: [{ elementType: 'labels', stylers: [{ visibility: 'off' }] }, ...(widget.labels !== false ? [{ elementType: 'labels', stylers: [{ visibility: 'on' }] }] : [])],
          zoomControl: controls,
          draggable: true,
          disableDefaultUI: true,
          scrollwheel: true,
        })
        const marker = new maps.Marker({ map, animation: maps.Animation.DROP, draggable: false, position: { lat, lng }, title: title ? `${title} ${address}` : address, icon: '' })
        marker.setIcon(null)
        maps.event.addListener(marker, 'click', () => {
          const at = encodeURIComponent(marker.getPosition().toUrlValue())
          window.open(`http://maps.google.com/maps?sll=${at}&q=${encodeURIComponent(address)}&z=${encodeURIComponent(map.getZoom())}`)
        })
      })
      .catch(() => undefined)
    return () => {
      gone = true
    }
  }, [widget, lat, lng, zoom])

  return <div ref={el} className="page-map" />
}
