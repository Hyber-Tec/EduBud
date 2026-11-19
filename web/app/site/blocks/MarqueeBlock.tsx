import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { MarqueeBlock as Data } from '~/content/types'

/**
 * A line of text scrolling sideways without end, drawn as the original draws it: its items (each followed by the
 * block's item spacing) written along an SVG path, straight or waving, that starts one wavelength left of the block.
 * The items are first laid out once, hidden, to measure them; their text style is the block's setting (a heading's
 * font or a paragraph's), and the line fades at its ends when the block asks for it.
 */
export function MarqueeBlock({ block }: { block: Data }) {
  const inner = <Marquee block={block} />
  return <div className="block marquee-block">{block.link ? <a href={block.link.href}>{inner}</a> : inner}</div>
}

/** The original's proportions: the baseline at 0.662 of the text's height, the line drawn 0.1 of it lower, and the
 * wave's curves pulled a third of a wavelength. */
const BASELINE = 0.662
const DROP = 0.1
const CURVE = 0.333

interface Layout {
  /** The block's width, the text's height (one line), and the length of one wave (crest to trough). */
  region: number
  height: number
  wave: number
  /** Each item's width and the spacing after it, and one repeat of all of them (the measured group). */
  items: { width: number; spacing: number }[]
  group: number
  /** How many repeats it takes to fill the path. */
  repeats: number
}

/** A wave's length for the frequency setting: 250px at 0, 1000px from 10 up. */
const waveLength = (frequency: number) => {
  const t = Math.min(Math.max(0.1 * frequency, 0), 1)
  return 250 * (1 - t) + 1000 * t
}

/** The path: from one wavelength left of the block to one past its right, every other point `intensity` lower. */
function wavePath(region: number, height: number, wave: number, intensity: number): string {
  const start = -wave
  const baseline = height * BASELINE
  const points = Math.ceil((region + 2 * wave) / wave) + 1
  let d = `M${start},${baseline} `
  for (let n = 0; n < points; n++) {
    const x = start + n * wave
    const y = baseline + (n % 2 === 0 ? 0 : intensity)
    d += n === 0 ? ` L${x},${y}` : ` S${x - wave * CURVE},${y} ${x},${y}`
  }
  return d
}

function Marquee({ block }: { block: Data }) {
  const id = `marquee-${useId().replace(/:/g, '')}`
  const root = useRef<HTMLDivElement>(null)
  const measure = useRef<HTMLDivElement>(null)
  const path = useRef<SVGPathElement>(null)
  const textPath = useRef<SVGTextPathElement>(null)
  const [layout, setLayout] = useState<Layout | null>(null)

  // Measure the items (again when the fonts arrive or the block changes size).
  useLayoutEffect(() => {
    const el = root.current
    const box = measure.current
    if (!el || !box) return
    const read = () => {
      const nodes = [...box.children] as HTMLElement[]
      const items = nodes.map((n) => ({ width: n.clientWidth, spacing: parseFloat(getComputedStyle(n).marginRight) || 0 }))
      const region = Math.max(el.clientWidth, 50)
      const group = Math.max(box.clientWidth, 50)
      const wave = waveLength(block.waveFrequency)
      // The path is a little longer than the block when it waves; enough repeats to cover it and one more.
      const length = (region + 2 * wave) * (block.waveIntensity > 0 ? 1.5 : 1)
      setLayout({ region, height: nodes[0]?.clientHeight ?? 0, wave, items, group, repeats: Math.ceil(length / group) + 1 })
    }
    read()
    document.fonts?.ready.then(read)
    const resized = new ResizeObserver(read)
    resized.observe(el)
    resized.observe(box)
    return () => resized.disconnect()
  }, [block.waveFrequency, block.waveIntensity])

  // Move it as the original does: by its speed setting in pixels on every frame the screen draws (so twice as fast on
  // a 120 Hz screen as on a 60 Hz one, like the original), only while it's on screen, and not at all for visitors who
  // ask for less motion. Left takes the text left, right takes it right.
  const group = layout?.group ?? 0
  useEffect(() => {
    const el = root.current
    const tp = textPath.current
    if (!el || !tp || !group || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const step = (block.direction === 'right' ? 1 : -1) * block.speed
    let progress = 0
    let frame = 0
    const tick = () => {
      progress -= step
      tp.setAttribute('startOffset', String(-((((group + progress) % group) + group) % group)))
      frame = requestAnimationFrame(tick)
    }
    const observer = new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(frame)
      frame = entry?.isIntersecting ? requestAnimationFrame(tick) : 0
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [group, block.direction, block.speed])

  // Each item's place along the path, one repeat after another.
  const placed: { text: string; x: number }[] = []
  if (layout) {
    let x = 0
    for (let r = 0; r < layout.repeats; r++)
      layout.items.forEach((item, i) => {
        placed.push({ text: block.items[i] ?? '', x })
        x += item.width + item.spacing
      })
  }
  const style = block.textStyle.startsWith('paragraph') ? 'paragraph' : 'heading'
  return (
    <div className={`marquee marquee--${style} marquee-text`} ref={root}>
      <div className="marquee-measure" ref={measure} aria-hidden="true">
        {block.items.map((text, i) => (
          <span key={i} className="marquee-item">
            {text}
          </span>
        ))}
      </div>
      <div className="marquee-display">
        <svg
          className="marquee-svg"
          fill="currentColor"
          aria-hidden="true"
          style={layout ? { height: `${layout.height + block.waveIntensity}px`, transform: `translateY(${layout.height * DROP}px)` } : undefined}
        >
          {layout && (
            <>
              <path ref={path} id={id} d={wavePath(layout.region, layout.height, layout.wave, block.waveIntensity)} fill="none" />
              <text>
                <textPath ref={textPath} href={`#${id}`} startOffset="0">
                  {placed.map((p, i) => (
                    <tspan key={i} x={p.x}>
                      {p.text}
                    </tspan>
                  ))}
                </textPath>
              </text>
            </>
          )}
        </svg>
      </div>
      <span className="visually-hidden">{block.items.join(' ')}</span>
    </div>
  )
}
