import { useEffect, useId, useRef, useState } from 'react'
import type { MarqueeBlock as Data } from '~/content/types'

/** Pixels a second the line moves at speed setting 1. */
const PX_PER_SECOND = 60

/**
 * A line of text scrolling sideways without end, as the original's: straight, or riding a wave (its text on an SVG
 * path that curves up and down by the wave's intensity, every 400 px).
 */
export function MarqueeBlock({ block }: { block: Data }) {
  const text = block.items.join('')
  const inner = block.waveIntensity > 0 ? <WaveMarquee block={block} text={text} /> : <StraightMarquee block={block} text={text} />
  return <div className="block marquee-block">{block.link ? <a href={block.link.href}>{inner}</a> : inner}</div>
}

function StraightMarquee({ block, text }: { block: Data; text: string }) {
  const run = Array.from({ length: 12 }, (_, i) => (
    <p key={i} className="marquee-item">
      {text}
    </p>
  ))
  return (
    <div className={`marquee marquee--${block.direction}`} style={{ ['--marquee-speed' as string]: block.speed }}>
      <div className="marquee-track" aria-hidden="true">
        {run}
      </div>
      <div className="marquee-track" aria-hidden="true">
        {run}
      </div>
      <span className="visually-hidden">{text}</span>
    </div>
  )
}

/** The wave: crests and troughs every 400 px, `intensity` apart, from 400 px left of the block to past its right. */
function wavePath(width: number, top: number, intensity: number): string {
  const parts = [`M-400,${top} L-400,${top}`]
  for (let x = 0, down = true; x <= width + 800; x += 400, down = !down) {
    const y = down ? top + intensity : top
    parts.push(`S${x - 266.8},${y} ${x},${y}`)
  }
  return parts.join(' ')
}

function WaveMarquee({ block, text }: { block: Data; text: string }) {
  const id = useId().replace(/:/g, '')
  const box = useRef<HTMLDivElement>(null)
  const textPath = useRef<SVGTextPathElement>(null)
  const [size, setSize] = useState({ width: 1380, fontSize: 68.84 })

  useEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => setSize({ width: el.clientWidth, fontSize: parseFloat(getComputedStyle(el).fontSize) || 68.84 })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const tp = textPath.current
    if (!tp) return
    const period = tp.getComputedTextLength() / 20 || 1
    const sign = block.direction === 'right' ? 1 : -1
    let offset = -period
    let last = performance.now()
    let frame = 0
    const step = (now: number) => {
      offset += (sign * PX_PER_SECOND * block.speed * (now - last)) / 1000
      last = now
      if (offset > 0) offset -= period
      if (offset < -period) offset += period
      tp.setAttribute('startOffset', String(offset - 400))
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [block.direction, block.speed, size])

  const lineHeight = size.fontSize * 1.4
  const top = lineHeight / 2 + size.fontSize * 0.2236
  return (
    <div ref={box} className="marquee-wave marquee-item" style={{ height: `calc(1.4em + ${block.waveIntensity}px)` }}>
      <svg className="marquee-wave-svg" width="100%" height="100%" aria-hidden="true">
        <g transform={`translate(0, ${(size.fontSize * 0.0697).toFixed(2)})`}>
          <path id={`wave-${id}`} d={wavePath(size.width, top, block.waveIntensity)} fill="none" />
        </g>
        <text>
          <textPath ref={textPath} href={`#wave-${id}`} startOffset="-400">
            {Array.from({ length: 20 }, () => text).join('')}
          </textPath>
        </text>
      </svg>
      <span className="visually-hidden">{text}</span>
    </div>
  )
}
