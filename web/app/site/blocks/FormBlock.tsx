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
}

/**
 * The original's forms (contact, newsletter), drawn the same way. They check what's typed and thank the visitor, but
 * store nothing yet: the forms inbox comes later (docs/DECISIONS.md §3).
 */
export function FormBlock({ block }: { block: Data }) {
  const cfg = block.config as { formFields?: Field[]; formSubmitButtonText?: string; formSubmissionMessage?: { html?: string } }
  const [sent, setSent] = useState(false)
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (e.currentTarget.reportValidity()) setSent(true)
  }
  return (
    <div className="block form-block">
      {sent ? (
        <div className="form-sent rte" dangerouslySetInnerHTML={{ __html: cfg.formSubmissionMessage?.html ?? '<p>Thank you!</p>' }} />
      ) : (
        <form className="form" onSubmit={submit}>
          <div className="form-fields">
            {(cfg.formFields ?? []).map((f) => (
              <FormField key={f.id} field={f} />
            ))}
          </div>
          <div className="form-button-wrapper">
            <button type="submit" className="button button--primary form-submit">
              {cfg.formSubmitButtonText ?? 'Submit'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

const Required = () => <span className="form-required">(required)</span>

function FormField({ field: f }: { field: Field }) {
  if (f.type === 'name') {
    return (
      <fieldset className="form-item form-name">
        <legend className="form-title">{f.title}</legend>
        {(['first', 'last'] as const).map((part) => (
          <div key={part} className="form-field form-name-part">
            <label className="form-caption" htmlFor={`${f.id}-${part}`}>
              {part === 'first' ? 'First Name' : 'Last Name'}
              {f.required && <Required />}
            </label>
            <input id={`${f.id}-${part}`} className="form-input" type="text" autoComplete={part === 'first' ? 'given-name' : 'family-name'} required={f.required} />
          </div>
        ))}
      </fieldset>
    )
  }
  const input =
    f.type === 'textarea' ? (
      <textarea id={f.id} className="form-input form-textarea" placeholder={f.placeholder} required={f.required} />
    ) : (
      <input id={f.id} className="form-input" type={f.type === 'email' ? 'email' : 'text'} autoComplete={f.type === 'email' ? 'email' : undefined} placeholder={f.placeholder} required={f.required} />
    )
  return (
    <div className={`form-item form-field form-field--${f.type}`}>
      <label className="form-title" htmlFor={f.id}>
        <span>{f.title}</span>
        {f.required && <Required />}
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
