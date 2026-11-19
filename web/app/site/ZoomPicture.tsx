import { useRef, useState } from 'react'
import type { Picture } from '~/content/types'
import { srcSet } from './Picture'

/**
 * A picture of text (a class schedule, a table) that's too small to read on a phone: on phones the picture is a
 * button that opens it full size, as tall as the screen, to scroll across and pinch to zoom; the close button or the
 * back gesture's Escape closes it. Wider screens never show the button (styles/phone.css), so nothing changes there.
 */
export function ZoomPicture({ picture }: { picture: Picture }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const name = picture.alt ? `Open full size: ${picture.alt}` : 'Open the picture full size'
  return (
    <>
      <button
        type="button"
        className="zoom-open"
        aria-label={name}
        onClick={() => {
          setOpen(true)
          dialog.current?.showModal()
        }}
      >
        <span className="zoom-open-sign" aria-hidden="true">
          {/* A magnifying glass with a plus. */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="M15.5 15.5 21 21M10.5 7.5v6M7.5 10.5h6" />
          </svg>
        </span>
      </button>
      <dialog ref={dialog} className="zoom-viewer" aria-label={picture.alt || 'Picture'} onClose={() => setOpen(false)}>
        {/* The full picture loads only once it's opened. */}
        <div className="zoom-viewer-scroll">{open && <img src={`${picture.base}/${picture.widths.at(-1)}.${picture.ext}`} srcSet={srcSet(picture)} sizes="300vw" alt={picture.alt} />}</div>
        <button type="button" className="zoom-close" aria-label="Close" onClick={() => dialog.current?.close()}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </dialog>
    </>
  )
}
