import { useState } from 'react'
import { Button } from '~/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel, FieldSeparator } from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import { GoogleButton } from './GoogleButton'
import { NotOpenNotice } from './NotOpenNotice'
import { PasswordInput } from './PasswordInput'
import { useForm } from './useForm'
import { checkEmail, checkPassword } from './validation'

/**
 * The log-in form. Logging in isn't open yet: its buttons show a notice and send nothing anywhere.
 *
 * The inputs have no `name`, so even a form sent before the page's script has loaded carries nothing with it.
 */
export function LoginForm() {
  const [noticeShown, setNoticeShown] = useState(0)
  const showNotice = () => setNoticeShown((n) => n + 1)
  const { errors, field, submit } = useForm({ email: '', password: '' }, (v) => ({ email: checkEmail(v.email), password: checkPassword(v.password) }))

  return (
    <form noValidate onSubmit={submit(showNotice)}>
      <NotOpenNotice shown={noticeShown} title="Logging in isn't open yet" />
      <FieldGroup>
        <GoogleButton onClick={showNotice}>Continue with Google</GoogleButton>
        <FieldSeparator>or</FieldSeparator>

        <Field data-invalid={errors.email ? true : undefined}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required {...field('email')} />
          <FieldError id="email-error">{errors.email}</FieldError>
        </Field>

        <Field data-invalid={errors.password ? true : undefined}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <PasswordInput autoComplete="current-password" required {...field('password')} />
          <FieldError id="password-error">{errors.password}</FieldError>
          <div className="flex justify-end">
            <Button type="button" variant="link" size="inline" className="text-sm" onClick={showNotice}>
              Forgot password?
            </Button>
          </div>
        </Field>

        <Button type="submit" className="w-full">
          Log in
        </Button>
      </FieldGroup>
    </form>
  )
}
