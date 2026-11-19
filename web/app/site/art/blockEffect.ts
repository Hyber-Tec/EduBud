import { useEffect, useRef } from 'react'
import type { GenerativeSettings } from '~/content/types'
import { startArt } from './stage'

/**
 * Runs the effect on an image block's picture (Our Team's film grain, filmGrain.ts) on the shared art canvases
 * (stage.ts), as the original's image blocks run theirs: once the picture has loaded, drawn from it at the screen's
 * full pixel ratio, never paused; and not for visitors who ask for less motion, for whom it stops, or starts again,
 * as they change their mind. Returns the box it draws in: put it next to the picture, over it.
 */
export function useBlockEffect(effect: GenerativeSettings | undefined) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = box.current
    const img = node?.parentElement?.querySelector('img')
    if (!effect || !node || !img) return
    const lessMotion = matchMedia('(prefers-reduced-motion: reduce)')
    let art: ReturnType<typeof startArt> | undefined
    const start = () => {
      if (art || lessMotion.matches || !img.complete || !img.naturalWidth) return
      art = startArt(node, { ...effect, pixelRatio: devicePixelRatio || 1 }, { changed() {}, drawn() {} })
    }
    const stop = () => {
      art?.stop()
      art = undefined
    }
    const motionChanged = () => (lessMotion.matches ? stop() : start())
    img.addEventListener('load', start)
    lessMotion.addEventListener('change', motionChanged)
    start()
    return () => {
      img.removeEventListener('load', start)
      lessMotion.removeEventListener('change', motionChanged)
      stop()
    }
  }, [effect])
  return box
}
