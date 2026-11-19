// The log-in and sign-up forms' rules, checked in the browser. Each returns the message to show, or nothing when the
// value is fine. The messages say what to do, in EduBud's plain words.

export const PASSWORD_MIN_LENGTH = 8

// Something before an @, something after it, and a dot in that part: what browsers accept, roughly, without being
// picky about the rest (the real check is the email that arrives, once accounts open).
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function checkEmail(email: string): string | undefined {
  if (!email.trim()) return 'Enter your email address'
  if (!EMAIL.test(email.trim())) return 'Enter an email address like name@example.com'
}

/** Log in: any password the person has (its length was checked when they made it). */
export function checkPassword(password: string): string | undefined {
  if (!password) return 'Enter your password'
}

/** Sign up: a new password, at least PASSWORD_MIN_LENGTH characters. */
export function checkNewPassword(password: string): string | undefined {
  if (!password) return 'Enter a password'
  if (password.length < PASSWORD_MIN_LENGTH) return `Your password needs at least ${PASSWORD_MIN_LENGTH} characters`
}

export function checkName(name: string, which: 'first' | 'last'): string | undefined {
  if (!name.trim()) return `Enter your ${which} name`
}
