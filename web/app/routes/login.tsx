import { AuthLayout } from '~/auth/AuthLayout'
import { LoginForm } from '~/auth/LoginForm'

/** /login: logging in to EduBud. Nothing signs in yet (the owner's call): the form only shows a notice. */
export function meta() {
  return [
    { title: 'Log in — EduBud International' },
    { name: 'description', content: 'Log in to your EduBud account.' },
    { name: 'robots', content: 'noindex, nofollow' },
  ]
}

export default function Login() {
  return (
    <AuthLayout title="Log in" intro="Welcome back to EduBud." other={{ question: 'New to EduBud?', link: 'Create an account', to: '/signup' }}>
      <LoginForm />
    </AuthLayout>
  )
}
