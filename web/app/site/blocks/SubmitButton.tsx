/** Where a form is in sending: nothing yet, sending, refused (with errors), or sent. */
export type SubmitState = 'none' | 'submitting' | 'error' | 'submitted'

interface Props {
  label: string
  /** What screen readers hear while it sends. */
  busyLabel?: string
  state: SubmitState
  /** The button's own look (its size and colours). */
  className: string
}

/**
 * A form's submit button, as the original draws it (its "bar" style): the label; while sending, a thin line running
 * across where the label was; once sent, a tick that wipes in; refused, the label again and a shake. The three are
 * stacked in one place and cross-fade (blocks.css).
 */
export function SubmitButton({ label, busyLabel = 'Submitting…', state, className }: Props) {
  return (
    <button type="submit" className={`submit-button ${className}`} data-state={state} aria-live={state === 'submitting' ? 'polite' : undefined}>
      <span className="visually-hidden">{state === 'submitting' ? busyLabel : label}</span>
      <span className="submit-state" aria-hidden="true">
        <span className="submit-state-label">{label}</span>
        <span className="submit-state-bar">
          <span />
        </span>
        <span className="submit-state-tick">
          <span />
        </span>
      </span>
    </button>
  )
}
