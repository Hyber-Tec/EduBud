import type { ImageBlock as Data } from '~/content/types'
import { focal, Img } from '../Picture'

export function ImageBlock({ block }: { block: Data }) {
  const img = (
    <Img
      picture={block.picture}
      className="image-media"
      style={{ objectPosition: focal(block.picture) ?? 'var(--image-component-focal-point)' }}
    />
  )
  return (
    <div className={`block image-block${block.stretched ? ' image-block--stretched' : ''}`}>
      <div className="image-frame">
        {block.link ? (
          <a href={block.link.href} target={block.link.newWindow ? '_blank' : undefined} rel={block.link.newWindow ? 'noopener' : undefined}>
            {img}
          </a>
        ) : (
          img
        )}
        <div className="image-overlay" />
      </div>
    </div>
  )
}
