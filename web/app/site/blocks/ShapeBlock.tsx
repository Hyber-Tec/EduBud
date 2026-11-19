import type { Area, ShapeBlock as Data } from '~/content/types'

const X: Record<string, string> = { 'flex-start': 'xMin', center: 'xMid', 'flex-end': 'xMax' }
const Y: Record<string, string> = { 'flex-start': 'YMin', center: 'YMid', 'flex-end': 'YMax' }

/** How the shape keeps its proportions inside its block, aligned as the block is. */
function fit(stretched: boolean, area: Area): string {
  if (stretched) return 'none'
  return `${X[area.justify ?? 'center'] ?? 'xMid'}${Y[area.align ?? 'center'] ?? 'YMid'} meet`
}

/** A filled shape (the green flowers and ovals), drawn as the original draws it: phones may get another shape. */
export function ShapeBlock({ block }: { block: Data }) {
  const phone = block.phone ?? block
  const shapes = (
    <>
      <svg className="shape shape--mobile" viewBox={phone.viewBox} preserveAspectRatio={fit(phone.stretched, block.mobile)} aria-hidden="true" dangerouslySetInnerHTML={{ __html: phone.svg }} />
      <svg className="shape shape--desktop" viewBox={block.viewBox} preserveAspectRatio={fit(block.stretched, block.desktop)} aria-hidden="true" dangerouslySetInnerHTML={{ __html: block.svg }} />
    </>
  )
  return (
    <div className="block shape-block">
      {block.link ? <a href={block.link.href}>{shapes}</a> : shapes}
      {block.html && <div className="shape-text rte" dangerouslySetInnerHTML={{ __html: block.html }} />}
    </div>
  )
}
