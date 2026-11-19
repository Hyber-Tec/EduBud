import site from '~/content/site.json'
import type { Section as SectionData } from '~/content/types'
import { Section } from './Section'

const sections = site.footer as unknown as SectionData[]

/** The footer: the same sections at the bottom of every page. */
export function Footer() {
  return (
    <footer className="site-footer">
      {sections.map((s, i) => (
        <Section key={s.id} section={s} index={i + 1} />
      ))}
    </footer>
  )
}
