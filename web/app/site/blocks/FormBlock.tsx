import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { FormBlock as Data } from '~/content/types'
import { FormError } from './FormError'
import { SubmitButton, type SubmitState } from './SubmitButton'

interface Field {
  id: string
  type: string
  title: string
  required?: boolean
  placeholder?: string
  description?: string
  mailingList?: boolean
}

/** What's wrong, as the original's server answers: by field id (`id.First` for a name's first part). */
type Errors = Record<string, string>

/**
 * How long the button shows its running line: about as long as the original's round trip to its server takes (0.4 s
 * measured for a refused submission, more for a saved one). Then how long the tick shows before the thank-you replaces
 * the form (the original's own 1 s).
 */
const ANSWER_MS = 600
const TICK_MS = 1000

/** The original's own wording for its errors. */
const MESSAGES = {
  form: 'There was an error submitting the form.',
  required: (title: string) => `${title} is required.`,
  email: 'Email addresses should follow the format user@domain.com.',
}

/** Something@somewhere.tld, as an address must look. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** The ids of a field's inputs, as FormField names them. */
const inputId = (f: Field, part?: 'first' | 'last') => (part ? `${f.id}-${part}` : f.id)

/** Checks what was typed as the original's server does, and returns what's wrong (nothing when all is well). */
function check(form: HTMLFormElement, fields: Field[]): Errors {
  const value = (id: string) => ((form.querySelector(`#${CSS.escape(id)}`) as HTMLInputElement | null)?.value ?? '').trim()
  const errors: Errors = {}
  for (const f of fields) {
    if (f.type === 'name') {
      if (f.required && !value(inputId(f, 'first'))) errors[`${f.id}.First`] = MESSAGES.required('First Name')
      if (f.required && !value(inputId(f, 'last'))) errors[`${f.id}.Last`] = MESSAGES.required('Last Name')
      continue
    }
    const v = value(inputId(f))
    if (!v) {
      if (f.required) errors[f.id] = MESSAGES.required(f.title)
    } else if (f.type === 'email' && !EMAIL.test(v)) errors[f.id] = MESSAGES.email
  }
  return errors
}

/**
 * The original's forms (contact, newsletter), drawn the same way. They check what's typed and thank the visitor as the
 * original does, but send and store nothing yet: the forms inbox comes later (docs/DECISIONS.md §3).
 *
 * Pressing Submit shows the button's running line for as long as the original's server takes to answer; then either
 * the errors appear (one above the form, one above each field that's wrong, the first of them focused, and the button
 * shakes), or the button shows a tick for a second and the thank-you takes the form's place (the form keeps its room).
 */
export function FormBlock({ block }: { block: Data }) {
  const cfg = block.config as { formFields?: Field[]; formSubmitButtonText?: string; formSubmissionMessage?: { html?: string } }
  const fields = cfg.formFields ?? []
  const [state, setState] = useState<SubmitState>('none')
  const [errors, setErrors] = useState<Errors | null>(null)
  const [sent, setSent] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const formRef = useRef<HTMLFormElement>(null)
  const thanksRef = useRef<HTMLDivElement>(null)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  // The thank-you takes the focus once it shows, as the original's does (so screen readers read it).
  useEffect(() => {
    if (sent) thanksRef.current?.focus()
  }, [sent])

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (state === 'submitting' || state === 'submitted') return
    setState('submitting')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const form = formRef.current
      if (!form) return
      const found = check(form, fields)
      const first = Object.keys(found)[0]
      if (first) {
        setErrors(found)
        setState('error')
        // The first field that's wrong takes the focus, as on the original.
        const [id, part] = first.split('.')
        const f = fields.find((x) => x.id === id)
        if (f) (form.querySelector(`#${CSS.escape(inputId(f, part === 'First' ? 'first' : part === 'Last' ? 'last' : undefined))}`) as HTMLElement | null)?.focus()
      } else {
        setErrors(null)
        setState('submitted')
        timer.current = window.setTimeout(() => setSent(true), TICK_MS)
      }
    }, ANSWER_MS)
  }

  return (
    <div className="block form-block">
      <div className="form-wrapper">
        {sent && <div ref={thanksRef} className="form-sent" tabIndex={-1} dangerouslySetInnerHTML={{ __html: cfg.formSubmissionMessage?.html ?? 'Thank you!' }} />}
        <form ref={formRef} className={`form${sent ? ' form--sent' : ''}`} noValidate onSubmit={submit}>
          {errors && (
            <div className="form-banner">
              <FormError>{MESSAGES.form}</FormError>
            </div>
          )}
          <div className="form-fields">
            {fields.map((f) => (
              <FormField key={f.id} field={f} errors={errors ?? {}} />
            ))}
          </div>
          <div className="form-button-wrapper">
            <SubmitButton label={cfg.formSubmitButtonText ?? 'Submit'} state={state} className="button button--primary form-submit" />
          </div>
        </form>
      </div>
    </div>
  )
}

const Required = () => <span className="form-required">(required)</span>

/** The ARIA attributes of an input that's wrong (or of one that's fine). */
const invalid = (error: string | undefined, id: string) => (error ? { 'aria-invalid': true, 'aria-describedby': `${id}-error` } : { 'aria-invalid': false })

function FormField({ field: f, errors }: { field: Field; errors: Errors }) {
  if (f.type === 'name') {
    return (
      <fieldset className="form-item form-name">
        <legend className="form-title">{f.title}</legend>
        {(['first', 'last'] as const).map((part) => {
          const id = inputId(f, part)
          const error = errors[`${f.id}.${part === 'first' ? 'First' : 'Last'}`]
          return (
            <div key={part} className="form-field form-name-part">
              <label className="form-caption" htmlFor={id}>
                {part === 'first' ? 'First Name' : 'Last Name'}
                {f.required && <Required />}
              </label>
              {error && <FormError id={`${id}-error`}>{error}</FormError>}
              <input
                id={id}
                className="form-input"
                type="text"
                autoComplete={part === 'first' ? 'given-name' : 'family-name'}
                aria-required={f.required || undefined}
                {...invalid(error, id)}
              />
            </div>
          )
        })}
      </fieldset>
    )
  }
  const error = errors[f.id]
  const common = { id: f.id, placeholder: f.placeholder, 'aria-required': f.required || undefined, ...invalid(error, f.id) }
  const input =
    f.type === 'textarea' ? (
      <textarea className="form-input form-textarea" {...common} />
    ) : f.type === 'phone' ? (
      // A phone number brings up the number pad on phones, as the original's field does.
      <input className="form-input" type="text" inputMode="numeric" autoComplete="tel-national" {...common} />
    ) : (
      <input className="form-input" type={f.type === 'email' ? 'email' : 'text'} autoComplete={f.type === 'email' ? 'email' : undefined} {...common} />
    )
  return (
    <div className={`form-item form-field form-field--${f.type}`}>
      <label className="form-title" htmlFor={f.id}>
        <span className="form-title-row">
          <span>{f.title}</span>
          {f.required && <Required />}
        </span>
        {error && <FormError id={`${f.id}-error`}>{error}</FormError>}
      </label>
      {f.description && <p className="form-description">{f.description}</p>}
      {input}
      {f.mailingList && (
        <div className="form-option">
          <label className="form-checkbox">
            <input type="checkbox" />
            <span>Sign up for news and updates</span>
          </label>
        </div>
      )}
    </div>
  )
}
