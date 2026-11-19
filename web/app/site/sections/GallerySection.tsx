import type { Section } from '~/content/types'
import { contentFor } from './content'
import { GalleryGrid } from './GalleryGrid'
import { GalleryReel } from './GalleryReel'
import { GalleryRows } from './GalleryRows'

/** A gallery section (a grid, a reel, justified strips or masonry columns of pictures), drawn as the original's. */
export function GallerySection({ section }: { section: Section }) {
  const data = contentFor(section.id)
  return (
    <div className="gallery-section-content" data-gallery={section.id}>
      {data?.type === 'gallery' &&
        (data.design === 'grid' ? <GalleryGrid data={data} /> : data.design === 'reel' ? <GalleryReel data={data} /> : <GalleryRows data={data} />)}
    </div>
  )
}
