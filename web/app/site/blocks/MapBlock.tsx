import type { MapBlock as Data } from '~/content/types'

export function MapBlock({ block }: { block: Data }) {
  return (
    <div className="block map-block">
      <iframe
        title="Map"
        loading="lazy"
        src={`https://maps.google.com/maps?ll=${block.lat},${block.lng}&q=${block.lat},${block.lng}&z=${block.zoom}&output=embed`}
      />
    </div>
  )
}
