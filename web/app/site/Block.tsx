import type { Block as BlockData } from '~/content/types'
import { AccordionBlock } from './blocks/AccordionBlock'
import { ButtonBlock } from './blocks/ButtonBlock'
import { DonationBlock } from './blocks/DonationBlock'
import { FormBlock } from './blocks/FormBlock'
import { ImageBlock } from './blocks/ImageBlock'
import { InstagramBlock } from './blocks/InstagramBlock'
import { MapBlock } from './blocks/MapBlock'
import { MarqueeBlock } from './blocks/MarqueeBlock'
import { ShapeBlock } from './blocks/ShapeBlock'
import { TextBlock } from './blocks/TextBlock'
import { VideoBlock } from './blocks/VideoBlock'

/** One block of a section, by its kind. */
export function Block({ block }: { block: BlockData }) {
  switch (block.type) {
    case 'text':
      return <TextBlock block={block} />
    case 'image':
      return <ImageBlock block={block} />
    case 'shape':
      return <ShapeBlock block={block} />
    case 'button':
      return <ButtonBlock block={block} />
    case 'accordion':
      return <AccordionBlock block={block} />
    case 'marquee':
      return <MarqueeBlock block={block} />
    case 'video':
      return <VideoBlock block={block} />
    case 'line':
      return (
        <div className="block line-block">
          <hr />
        </div>
      )
    case 'form':
      return <FormBlock block={block} />
    case 'map':
      return <MapBlock block={block} />
    case 'donation':
      return <DonationBlock block={block} />
    case 'instagram':
      return <InstagramBlock block={block} />
    case 'snapshot':
      return (
        <div className="block snapshot-block">
          <img src={`${block.picture.base}/${block.picture.widths.at(-1)}.${block.picture.ext}`} alt={block.label} />
        </div>
      )
  }
}
