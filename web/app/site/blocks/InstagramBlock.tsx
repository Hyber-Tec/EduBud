import type { InstagramBlock as Data } from '~/content/types'

export function InstagramBlock({ block }: { block: Data }) {
  return (
    <div className="block instagram-block">
      <div className="instagram-grid">
        {block.posts.map((p, i) => (
          <a key={i} href={p.href} target="_blank" rel="noopener">
            <img src={`${p.picture.base}/${p.picture.widths.at(-1)}.${p.picture.ext}`} alt={p.picture.alt} loading="lazy" />
          </a>
        ))}
      </div>
    </div>
  )
}
