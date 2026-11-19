import type { ImageBlock as Data } from '~/content/types'
import { phoneChange } from '../phoneLayout'
import { focal, Img } from '../Picture'
import { ZoomPicture } from '../ZoomPicture'

export function ImageBlock({ block }: { block: Data }) {
  const img = (
    <Img
      picture={block.picture}
      className="image-media"
      style={{ objectPosition: focal(block.picture) ?? 'var(--image-component-focal-point)' }}
    />
  )
  return (
    <div className={`block image-block${block.stretched ? ' image-block--stretched' : ''}${block.position ? ` image-block--${block.position}` : ''}`}>
      {/* A masked picture (a circle, a flower…) fills a square frame, whatever the photo's own shape, as on the
          original: its shape is drawn in a square. */}
      <div className={`image-frame${block.maskSvg ? ' image-frame--masked' : ''}`}>
        {block.link ? (
          <a href={block.link.href} target={block.link.newWindow ? '_blank' : undefined} rel={block.link.newWindow ? 'noopener' : undefined}>
            {img}
          </a>
        ) : (
          img
        )}
        <div className="image-overlay" />
        {/* A picture of text opens full size on phones (content/phone.json). */}
        {phoneChange(block.id)?.zoom && <ZoomPicture picture={block.picture} />}
      </div>
      {block.maskSvg && <div className="image-mask-defs" aria-hidden="true" dangerouslySetInnerHTML={{ __html: block.maskSvg }} />}
    </div>
  )
}
