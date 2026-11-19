import type { Section } from '~/content/types'

/** An "auto layout" list section (cards of items), drawn as the original's. */
export function ListSection({ section }: { section: Section }) {
  return <div className="list-section-content" data-list={section.id} />
}
