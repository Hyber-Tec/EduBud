import { useState } from 'react'
import { Button } from '~/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSeparator } from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import { GoogleButton } from './GoogleButton'
import { NotOpenNotice } from './NotOpenNotice'
import { PasswordInput } from './PasswordInput'
import { useForm } from './useForm'
import { checkEmail, checkName, checkNewPassword, PASSWORD_MIN_LENGTH } from './validation'

/**
 * The sign-up form. Creating accounts isn't open yet: its buttons show a notice and send nothing anywhere.
 *
 * The inputs have no `name`, so even a form sent before the page's script has loaded carries nothing with it.
 */
export function SignupForm() {
  const [noticeShown, setNoticeShown] = useState(0)
  const showNotice = () => setNoticeShown((n) => n + 1)
  const { errors, field, submit } = useForm({ firstName: '', lastName: '', email: '', password: '' }, (v) => ({
    firstName: checkName(v.firstName, 'first'),
    lastName: checkName(v.lastName, 'last'),
    email: checkEmail(v.email),
    password: checkNewPassword(v.password),
  }))

  return (
    <form noValidate onSubmit={submit(showNotice)}>
      <NotOpenNotice shown={noticeShown} title="Creating an account isn't open yet" />
      <FieldGroup>
        <GoogleButton onClick={showNotice}>Sign up with Google</GoogleButton>
        <FieldSeparator>or</FieldSeparator>

        <div className="grid grid-cols-2 items-start gap-4">
          <Field data-invalid={errors.firstName ? true : undefined}>
            <FieldLabel htmlFor="firstName">First name</FieldLabel>
            <Input type="text" autoComplete="given-name" required {...field('firstName')} />
            <FieldError id="firstName-error">{errors.firstName}</FieldError>
          </Field>
          <Field data-invalid={errors.lastName ? true : undefined}>
            <FieldLabel htmlFor="lastName">Last name</FieldLabel>
            <Input type="text" autoComplete="family-name" required {...field('lastName')} />
            <FieldError id="lastName-error">{errors.lastName}</FieldError>
          </Field>
        </div>

        <Field data-invalid={errors.email ? true : undefined}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required {...field('email')} />
          <FieldError id="email-error">{errors.email}</FieldError>
        </Field>

        <Field data-invalid={errors.password ? true : undefined}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <PasswordInput autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} required {...field('password', 'password-hint')} />
          <FieldDescription id="password-hint">At least {PASSWORD_MIN_LENGTH} characters</FieldDescription>
          <FieldError id="password-error">{errors.password}</FieldError>
        </Field>

        <Button type="submit" className="w-full">
          Create account
        </Button>
      </FieldGroup>
    </form>
  )
}
