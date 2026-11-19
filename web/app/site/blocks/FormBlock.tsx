import { useState, type FormEvent } from 'react'
import type { FormBlock as Data } from '~/content/types'

interface Field {
  id: string
  type: string
  title: string
  required?: boolean
  placeholder?: string
  description?: string
  mailingList?: boolean
  options?: string[]
}

/**
 * The original's forms (contact, newsletter), drawn the same way. They check what's typed and thank the visitor, but
 * store nothing yet: the forms inbox comes later (docs/DECISIONS.md §3).
 */
export function FormBlock({ block }: { block: Data }) {
  const cfg = block.config as { formFields?: Field[]; formSubmitButtonText?: string; formSubmissionMessage?: { html?: string } }
  const [sent, setSent] = useState(false)
  const fields = cfg.formFields ?? []
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (e.currentTarget.reportValidity()) setSent(true)
  }
  if (sent) {
    return (
      <div className="block form-block">
        <div className="form-sent rte" dangerouslySetInnerHTML={{ __html: cfg.formSubmissionMessage?.html ?? '<p>Thank you!</p>' }} />
      </div>
    )
  }
  return (
    <div className="block form-block">
      <form className="form" noValidate={false} onSubmit={submit}>
        {fields.map((f) => (
          <FormField key={f.id} field={f} />
        ))}
        <div className="form-button-wrapper">
          <button type="submit" className="button button--primary form-submit">
            {cfg.formSubmitButtonText ?? 'Submit'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Label({ field, htmlFor, text }: { field: Field; htmlFor?: string; text?: string }) {
  return (
    <label className="form-label" htmlFor={htmlFor}>
      {text ?? field.title}
      {field.required && <span className="form-required"> (required)</span>}
    </label>
  )
}

function FormField({ field: f }: { field: Field }) {
  switch (f.type) {
    case 'name':
      return (
        <fieldset className="form-field form-field--name">
          <legend className="form-label">
            {f.title}
            {f.required && <span className="form-required"> (required)</span>}
          </legend>
          <div className="form-name-parts">
            <div className="form-name-part">
              <label className="form-sublabel" htmlFor={`${f.id}-first`}>
                First Name{f.required && <span className="form-required"> (required)</span>}
              </label>
              <input id={`${f.id}-first`} className="form-input" type="text" autoComplete="given-name" required={f.required} />
            </div>
            <div className="form-name-part">
              <label className="form-sublabel" htmlFor={`${f.id}-last`}>
                Last Name{f.required && <span className="form-required"> (required)</span>}
              </label>
              <input id={`${f.id}-last`} className="form-input" type="text" autoComplete="family-name" required={f.required} />
            </div>
          </div>
        </fieldset>
      )
    case 'email':
      return (
        <div className="form-field form-field--email">
          <Label field={f} htmlFor={f.id} />
          {f.description && <p className="form-description">{f.description}</p>}
          <input id={f.id} className="form-input" type="email" autoComplete="email" placeholder={f.placeholder} required={f.required} />
          {f.mailingList && (
            <label className="form-checkbox">
              <input type="checkbox" />
              <span className="form-checkbox-mark" />
              <span>Sign up for news and updates</span>
            </label>
          )}
        </div>
      )
    case 'textarea':
      return (
        <div className="form-field form-field--textarea">
          <Label field={f} htmlFor={f.id} />
          {f.description && <p className="form-description">{f.description}</p>}
          <textarea id={f.id} className="form-input" placeholder={f.placeholder} required={f.required} />
        </div>
      )
    default:
      return (
        <div className={`form-field form-field--${f.type}`}>
          <Label field={f} htmlFor={f.id} />
          {f.description && <p className="form-description">{f.description}</p>}
          <input id={f.id} className="form-input" type="text" placeholder={f.placeholder} required={f.required} />
        </div>
      )
  }
}
