import type { TextBlock as Data } from '~/content/types'

/** Rich text as the original wrote it. Text marked "scaled" is fitted to the block's width by `fitText`. */
export function TextBlock({ block }: { block: Data }) {
  return (
    <div className="block text-block">
      <div className="rte" dangerouslySetInnerHTML={{ __html: block.html }} />
    </div>
  )
}
