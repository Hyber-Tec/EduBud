import type { ButtonBlock as Data } from '~/content/types'

export function ButtonBlock({ block }: { block: Data }) {
  const cls = `button button--${block.kind} button--${block.size}`
  return (
    <div className={`block button-block button-block--${block.alignment}${block.stretched ? ' button-block--stretched' : ''}`}>
      {block.link?.href ? (
        <a className={cls} href={block.link.href} target={block.link.newWindow ? '_blank' : undefined} rel={block.link.newWindow ? 'noopener' : undefined}>
          {block.label}
        </a>
      ) : (
        <a className={cls} href={block.link?.href ?? ''} onClick={(e) => e.preventDefault()}>
          {block.label}
        </a>
      )}
    </div>
  )
}
