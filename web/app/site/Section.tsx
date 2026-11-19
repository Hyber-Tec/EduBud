import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Area, Block as BlockData, Section as SectionData } from '~/content/types'
import { ArtBackground, PauseButtons, useArt, type ArtControl } from './art/ArtBackground'
import { Block } from './Block'
import { poseProps, useMotion } from './motion'
import { phoneChange, phoneLayout } from './phoneLayout'
import { focal, Img } from './Picture'
import { GallerySection } from './sections/GallerySection'
import { ListSection } from './sections/ListSection'

type Vars = CSSProperties & Record<`--${string}`, string | number | undefined>

const area = (a: Area) => `${a.rowStart} / ${a.colStart} / ${a.rowEnd} / ${a.colEnd}`

/** A block's place on the grid at both widths (on phones, as phoneLayout places it), as CSS variables our stylesheet reads. */
function blockStyle(b: BlockData, phone: Area): Vars {
  return {
    '--area-m': area(phone),
    '--area-d': area(b.desktop),
    '--z-m': phone.z,
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
    // A block that appears waits in its starting pose (site/motion.ts moves it to its place).
    if (b.motion?.appear) {
      const pose = Object.entries(poseProps('appear', b.motion.appear.pose))
      out.push(`@media (prefers-reduced-motion: no-preference) { [data-block="${b.id}"] { ${pose.map(([k, v]) => `${k}: ${v};`).join(' ')} } }`)
    }
  }
  return out.join('\n')
}

/** A block in its place on the grid, with its animations if it has any. */
function FeBlock({ block: b, phone }: { block: BlockData; phone: Area }) {
  const ref = useRef<HTMLDivElement>(null)
  useMotion(ref, b.motion)
  const classes = [
    'fe-block',
    `fe-block--${b.type}`,
    b.background && 'fe-block--bg',
    b.motion && 'fe-block--motion',
    b.motion?.appear && 'fe-block--appear',
    phoneChange(b.id)?.hide && 'fe-block--phone-hidden',
  ]
  return (
    <div ref={ref} className={classes.filter(Boolean).join(' ')} data-block={b.id} style={blockStyle(b, phone)}>
      <Block block={b} />
    </div>
  )
}

function Background({ section, art }: { section: SectionData; art: ArtControl }) {
  const bg = section.background
  if (!bg) return null
  return (
    <div className="section-background">
      {bg.image && <Img picture={bg.image} className="section-background-media" style={{ objectPosition: focal(bg.image) }} alt="" />}
      {bg.video && <BackgroundVideo src={bg.video.src} filter={bg.video.filter} />}
      {bg.art && <ArtBackground art={bg.art} control={art} />}
      {/* A picture gets its overlay; a video doesn't (the original keeps the setting but draws no overlay on it). */}
      {bg.overlayOpacity !== undefined && !bg.video && <div className="section-background-overlay" style={{ opacity: bg.overlayOpacity }} />}
    </div>
  )
}

/**
 * A section's background video, as the original's appears: the section's own colour, then (once the page's code runs)
 * a black screen with a spinner while the video loads, both as faint as the video (its filter), then the video. No
 * picture is shown before it: the original shows none.
 */
function BackgroundVideo({ src, filter }: { src: string; filter?: string }) {
  const video = useRef<HTMLVideoElement>(null)
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    const v = video.current
    if (!v) return
    // Already playing (from the browser's cache): no loading screen.
    if (!v.paused && v.readyState > 2) return
    setLoading(true)
    const done = () => setLoading(false)
    v.addEventListener('playing', done)
    return () => v.removeEventListener('playing', done)
  }, [])
  return (
    <div className="section-background-media section-background-video" style={{ filter }}>
      <video ref={video} className="section-background-media" src={src} autoPlay muted loop playsInline />
      {loading && (
        <div className="video-loading" aria-hidden="true">
          <div className="video-loading-indicator">
            <svg className="video-loading-spinner" viewBox="25 25 50 50">
              <circle cx="50" cy="50" r="20" />
            </svg>
          </div>
        </div>
      )}
    </div>
  )
}

/** How deep the bottom divider of the section before this one is (its --divider-height), if it has one. */
export function dividerAbove(sections: SectionData[], index: number): string | undefined {
  const prev = sections[index - 1]
  return prev?.classes.includes('has-section-divider') ? (prev.vars as Record<string, string> | undefined)?.['--divider-height'] : undefined
}

export function Section({ section, index, below }: { section: SectionData; index: number; below?: string }) {
  const css = sectionCss(section)
  const g = section.grid
  const phone = phoneLayout(section)
  const art = useArt(section.background?.art)
  const gridStyle: Vars = {
    '--rows-m': phone.rows,
    '--row-min-m': g.mobile.rowMin,
    '--rows-d': g.desktop.rows,
    '--row-scale': g.desktop.scale,
    '--gap': `${g.mobile.gap}px`,
    '--col-gap': `${g.mobile.colGap ?? g.mobile.gap}px`,
  }
  return (
    <section
      className={['page-section', index === 0 ? 'first-section' : '', section.kind ? `${section.kind}-section` : '', below ? 'below-divider' : '', ...section.classes].filter(Boolean).join(' ')}
      data-theme={section.theme}
      data-section={section.id}
      style={(below ? { ...section.vars, '--divider-above': below } : section.vars) as Vars}
    >
      {css && <style>{css}</style>}
      <div className="section-border">
        <Background section={section} art={art} />
      </div>
      <div className="content-wrapper">
        <div className="content">
          {section.kind === 'gallery' && <GallerySection section={section} />}
          {section.kind === 'list' && <ListSection section={section} />}
          {!section.kind && (
          <div className="fe-grid" style={gridStyle}>
            {section.blocks.map((b) => (
              <FeBlock key={b.id} block={b} phone={phone.areas.get(b.id)!} />
            ))}
          </div>
          )}
        </div>
        {section.background?.art?.settings && <PauseButtons control={art} />}
      </div>
    </section>
  )
}
