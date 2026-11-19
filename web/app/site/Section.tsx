import type { CSSProperties } from 'react'
import type { Area, Block as BlockData, Section as SectionData } from '~/content/types'
import { Block } from './Block'
import { focal, Img } from './Picture'

type Vars = CSSProperties & Record<`--${string}`, string | number | undefined>

const area = (a: Area) => `${a.rowStart} / ${a.colStart} / ${a.rowEnd} / ${a.colEnd}`

/** A block's place on the grid at both widths, and its own settings, as CSS variables our stylesheet reads. */
function blockStyle(b: BlockData): Vars {
  return {
    ...(b.vars as Vars),
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

/** Phone-only settings and a block's own rules, which inline styles can't express. */
function sectionCss(section: SectionData): string {
  const out: string[] = []
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
      {bg.art?.desktop && bg.art.mobile && (
        <picture>
          <source media="(max-width: 767px)" srcSet={`${bg.art.mobile.base}/${bg.art.mobile.widths.at(-1)}.${bg.art.mobile.ext}`} />
          <img className="section-background-media" src={`${bg.art.desktop.base}/${bg.art.desktop.widths.at(-1)}.${bg.art.desktop.ext}`} alt="" />
        </picture>
      )}
      {bg.overlayOpacity !== undefined && <div className="section-background-overlay" style={{ opacity: bg.overlayOpacity }} />}
    </div>
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
  }
  return (
    <section
      className={['page-section', index === 0 ? 'first-section' : '', ...section.classes].filter(Boolean).join(' ')}
      data-theme={section.theme}
      data-section={section.id}
      style={section.vars as Vars}
    >
      {css && <style>{css}</style>}
      <div className="section-border" style={section.divider ? { clipPath: `url(#divider-${section.id})` } : undefined}>
        <Background section={section} />
      </div>
      {section.divider && <svg className="section-divider-defs" aria-hidden="true" dangerouslySetInnerHTML={{ __html: section.divider.clipPath.replace(/id="[^"]*"/, `id="divider-${section.id}"`) }} />}
      <div className="content-wrapper">
        <div className="content">
          <div className="fe-grid" style={gridStyle}>
            {section.blocks.map((b) => (
              <div key={b.id} className={`fe-block fe-block--${b.type}`} data-block={b.id} style={blockStyle(b)}>
                <Block block={b} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
