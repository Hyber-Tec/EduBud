import { useState } from 'react'
import type { VideoBlock as Data } from '~/content/types'

export function VideoBlock({ block }: { block: Data }) {
  const [playing, setPlaying] = useState(false)
  if (block.provider === 'native' && block.file) {
    return (
      <div className="block video-block">
        <div className="video-frame video-frame--native">
          <video src={block.file.src} controls playsInline preload="metadata" poster={block.file.src.replace('video.mp4', 'poster.jpg')} />
        </div>
      </div>
    )
  }
  return (
    <div className="block video-block">
      <div className="video-frame" style={{ paddingBottom: `${block.ratio}%` }}>
        {playing ? (
          <iframe
            src={`https://www.youtube.com/embed/${block.videoId}?autoplay=1`}
            title={block.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <button type="button" className="video-poster" onClick={() => setPlaying(true)} aria-label={`Play ${block.title}`}>
            <img src={`https://i.ytimg.com/vi/${block.videoId}/hqdefault.jpg`} alt="" loading="lazy" />
            <span className="video-play" />
          </button>
        )}
      </div>
    </div>
  )
}
