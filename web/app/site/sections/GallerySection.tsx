import type { Section } from '~/content/types'

/** A gallery section (a grid or a reel of pictures), drawn as the original's. */
export function GallerySection({ section }: { section: Section }) {
  return <div className="gallery-section-content" data-gallery={section.id} />
}
