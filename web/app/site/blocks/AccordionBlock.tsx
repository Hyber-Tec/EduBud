import { useState } from 'react'
import type { AccordionBlock as Data } from '~/content/types'

export function AccordionBlock({ block }: { block: Data }) {
  const [open, setOpen] = useState<number[]>(block.firstOpen ? [0] : [])
  const toggle = (i: number) =>
    setOpen((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : block.allowMultiple ? [...cur, i] : [i]))
  const d = block.dividers
  const Title = block.titleTag ?? 'p'
  return (
    <div className="block accordion-block">
      <ul className={`accordion accordion--icon-${block.iconPlacement}`} data-title-align={block.titleAlign} data-description-align={block.descriptionAlign}>
        {block.items.map((item, i) => {
          const isOpen = open.includes(i)
          return (
            <li key={i} className="accordion-item" data-open={isOpen || undefined}>
              {d.enabled && d.first && i === 0 && <div className="accordion-divider accordion-divider--top" />}
              <Title className={`accordion-title ${block.titleClass}`}>
                <button type="button" aria-expanded={isOpen} onClick={() => toggle(i)}>
                  <span className="accordion-title-text">{item.title}</span>
                  <span className={`accordion-icon accordion-icon--${block.icon}`} aria-hidden="true">
                    {block.icon === 'plus' ? (
                      <span className="plus">
                        <span className="plus-h" />
                        <span className="plus-v" />
                      </span>
                    ) : (
                      <span className="arrow" />
                    )}
                  </span>
                </button>
              </Title>
              <div className="accordion-dropdown" hidden={!isOpen}>
                <div className={`accordion-description rte ${block.descriptionClass}`} dangerouslySetInnerHTML={{ __html: item.html }} />
              </div>
              {d.enabled && (i < block.items.length - 1 || d.last) && <div className="accordion-divider" />}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
