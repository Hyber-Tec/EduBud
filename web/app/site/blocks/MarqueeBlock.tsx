import type { MarqueeBlock as Data } from '~/content/types'

/** A line of text scrolling sideways without end: the items repeated, moved by a CSS animation. */
export function MarqueeBlock({ block }: { block: Data }) {
  const Tag = (block.textStyle.startsWith('heading-') ? `h${block.textStyle.slice(-1)}` : 'p') as 'h1'
  const run = Array.from({ length: 12 }, (_, i) => (
    <Tag key={i} className="marquee-item">
      {block.items.join('')}
    </Tag>
  ))
  const inner = (
    <div className={`marquee marquee--${block.direction}`} style={{ ['--marquee-speed' as string]: block.speed }}>
      <div className="marquee-track" aria-hidden="true">
        {run}
      </div>
      <div className="marquee-track" aria-hidden="true">
        {run}
      </div>
      <span className="visually-hidden">{block.items.join(' ')}</span>
    </div>
  )
  return <div className="block marquee-block">{block.link ? <a href={block.link.href}>{inner}</a> : inner}</div>
}
