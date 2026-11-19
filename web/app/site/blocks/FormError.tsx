/**
 * A form's error, as the original shows it: white text on a red pill, after a round "!" sign. Used above the fields
 * (the whole form's error) and above each field that's wrong.
 */
export function FormError({ id, children }: { id?: string; children: string }) {
  return (
    <span className="form-error" id={id}>
      <svg className="form-error-icon" width="15" height="15" viewBox="0 0 14 14" aria-hidden="true">
        <circle cx="7" cy="7" r="6.22" fill="none" stroke="currentColor" strokeWidth="1.56" />
        <path d="M6.22 3.11h1.56v5.44H6.22zM6.22 9.33h1.56v1.56H6.22z" fill="currentColor" />
      </svg>
      {children}
    </span>
  )
}
