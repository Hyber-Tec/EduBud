import { useState, type CSSProperties } from 'react'
import type { Area, Block as BlockData, Section as SectionData } from '~/content/types'
import { Block } from './Block'
import { focal, Img } from './Picture'
import { GallerySection } from './sections/GallerySection'
import { ListSection } from './sections/ListSection'

type Vars = CSSProperties & Record<`--${string}`, string | number | undefined>

const area = (a: Area) => `${a.rowStart} / ${a.colStart} / ${a.rowEnd} / ${a.colEnd}`

/** A block's place on the grid at both widths, as CSS variables our stylesheet reads. */
function blockStyle(b: BlockData): Vars {
  return {
    '--area-m': area(b.mobile),
    '--area-d': area(b.desktop),
    '--z-m': b.mobile.z,
    '--z-d': b.desktop.z,
    '--justify-m': b.mobile.justify,
    '--justify-d': b.desktop.justify,
    '--align-m': b.mobile.align,
    '--align-d': b.desktop.align,
  }
}

/**
 * Each block's own settings (variables), then its phone-only ones, then its other rules. They're a stylesheet rather
 * than inline styles so the phone values can win over the others, as on the original.
 */
function sectionCss(section: SectionData): string {
  const out: string[] = []
  for (const b of section.blocks) {
    const all = Object.entries(b.vars ?? {})
    if (all.length) out.push(`[data-block="${b.id}"] { ${all.map(([k, v]) => `${k}: ${v};`).join(' ')} }`)
  }
  for (const b of section.blocks) {
    const m = Object.entries(b.varsMobile ?? {})
    if (m.length) out.push(`@media (max-width: 767px) { [data-block="${b.id}"] { ${m.map(([k, v]) => `${k}: ${v};`).join(' ')} } }`)
    if (b.css) out.push(b.css)
  }
  return out.join('\n')
}

function Background({ section }: { section: SectionData }) {
  const bg = section.background
  if (!bg) return null
  return (
    <div className="section-background">
      {bg.image && <Img picture={bg.image} className="section-background-media" style={{ objectPosition: focal(bg.image) }} alt="" />}
      {bg.video && (
        <video
          className="section-background-media"
          src={bg.video.src}
          poster={bg.video.poster ? `${bg.video.poster.base}/1500.${bg.video.poster.ext}` : undefined}
          autoPlay
          muted
          loop
          playsInline
          style={{ filter: bg.video.filter }}
        />
      )}
      {bg.art && bg.art.images.length > 0 && (
        <picture>
          {bg.art.images
            .filter((i) => i.upTo)
            .map((i) => (
              <source key={i.src} media={`(max-width: ${i.upTo}px)`} srcSet={i.src} />
            ))}
          <img className="section-background-media" src={bg.art.images[bg.art.images.length - 1].src} alt="" loading="lazy" decoding="async" />
        </picture>
      )}
      {bg.overlayOpacity !== undefined && <div className="section-background-overlay" style={{ opacity: bg.overlayOpacity }} />}
    </div>
  )
}

/** The round button the original puts on a moving background (video or art): it pauses and plays it. */
function PauseButton() {
  const [paused, setPaused] = useState(false)
  return (
    <button
      type="button"
      className={`background-pause-button${paused ? ' background-pause-button--paused' : ''}`}
      aria-label={paused ? 'Play Background' : 'Pause Background'}
      onClick={(e) => {
        const video = e.currentTarget.closest('section')?.querySelector<HTMLVideoElement>('.section-background video')
        if (video) void (paused ? video.play() : video.pause())
        setPaused(!paused)
      }}
    />
  )
}

export function Section({ section, index }: { section: SectionData; index: number }) {
  const css = sectionCss(section)
  const g = section.grid
  const gridStyle: Vars = {
    '--rows-m': g.mobile.rows,
    '--row-min-m': g.mobile.rowMin,
    '--rows-d': g.desktop.rows,
    '--row-scale': g.desktop.scale,
    '--gap': `${g.mobile.gap}px`,
    '--col-gap': `${g.mobile.colGap ?? g.mobile.gap}px`,
  }
  return (
    <section
      className={['page-section', index === 0 ? 'first-section' : '', section.kind ? `${section.kind}-section` : '', ...section.classes].filter(Boolean).join(' ')}
      data-theme={section.theme}
      data-section={section.id}
      style={section.vars as Vars}
    >
      {css && <style>{css}</style>}
      <div className="section-border">
        <Background section={section} />
      </div>
      {(section.background?.video || (section.background?.art?.images.length ?? 0) > 0) && <PauseButton />}
      <div className="content-wrapper">
        <div className="content">
          {section.kind === 'gallery' && <GallerySection section={section} />}
          {section.kind === 'list' && <ListSection section={section} />}
          {!section.kind && (
          <div className="fe-grid" style={gridStyle}>
            {section.blocks.map((b) => (
              <div key={b.id} className={`fe-block fe-block--${b.type}${b.background ? ' fe-block--bg' : ''}`} data-block={b.id} style={blockStyle(b)}>
                <Block block={b} />
              </div>
            ))}
          </div>
          )}
        </div>
      </div>
    </section>
  )
}
