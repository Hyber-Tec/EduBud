import type { Area, ShapeBlock as Data } from '~/content/types'

const X: Record<string, string> = { 'flex-start': 'xMin', center: 'xMid', 'flex-end': 'xMax' }
const Y: Record<string, string> = { 'flex-start': 'YMin', center: 'YMid', 'flex-end': 'YMax' }

/** How the shape keeps its proportions inside its block, aligned as the block is. */
function fit(block: Data, area: Area): string {
  if (block.stretched) return 'none'
  return `${X[area.justify ?? 'center'] ?? 'xMid'}${Y[area.align ?? 'center'] ?? 'YMid'} meet`
}

/** A filled shape (the green flowers and ovals), drawn as the original draws it. */
export function ShapeBlock({ block }: { block: Data }) {
  const svg = (fitValue: string, cls: string) => (
    <svg className={`shape ${cls}`} viewBox={block.viewBox} preserveAspectRatio={fitValue} aria-hidden="true" dangerouslySetInnerHTML={{ __html: block.svg }} />
  )
  const shapes = (
    <>
      {svg(fit(block, block.mobile), 'shape--mobile')}
      {svg(fit(block, block.desktop), 'shape--desktop')}
    </>
  )
  return (
    <div className="block shape-block">
      {block.link ? <a href={block.link.href}>{shapes}</a> : shapes}
      {block.html && <div className="shape-text rte" dangerouslySetInnerHTML={{ __html: block.html }} />}
    </div>
  )
}
