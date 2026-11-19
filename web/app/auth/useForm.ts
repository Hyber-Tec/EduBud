import { useState, type ChangeEvent, type FormEvent } from 'react'

/** A message for each field that has a problem. */
export type Errors<Field extends string> = Partial<Record<Field, string>>

/**
 * A form's values and its errors, checked in the browser. Nothing is checked while someone first fills it in; after
 * they press its button once, the messages follow what they type. Pressing the button with errors puts the keyboard
 * in the first field that has one, and screen readers read its message with it.
 *
 * Each field's input is the element whose id is the field's name, with its message in `<name>-error`.
 */
export function useForm<Field extends string>(initial: Record<Field, string>, check: (values: Record<Field, string>) => Errors<Field>) {
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<Errors<Field>>({})
  const [submitted, setSubmitted] = useState(false)

  /** What an input needs: its id and value, how it changes, and where its message (and hint, if any) is. */
  function field(name: Field, hintId?: string) {
    const error = errors[name]
    return {
      id: name,
      value: values[name],
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        const next = { ...values, [name]: event.target.value }
        setValues(next)
        if (submitted) setErrors(check(next))
      },
      'aria-invalid': error ? true : undefined,
      'aria-describedby': [error && `${name}-error`, hintId].filter(Boolean).join(' ') || undefined,
    }
  }

  /** The form's submit handler: checks every field, then calls `onValid` when they're all fine. */
  function submit(onValid: () => void) {
    return (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const found = check(values)
      setErrors(found)
      setSubmitted(true)
      const first = (Object.keys(initial) as Field[]).find((name) => found[name])
      if (first) document.getElementById(first)?.focus()
      else onValid()
    }
  }

  return { errors, field, submit }
}
