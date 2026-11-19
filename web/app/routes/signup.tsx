import { AuthLayout } from '~/auth/AuthLayout'
import { SignupForm } from '~/auth/SignupForm'

/** /signup: creating an EduBud account. Nothing is created yet (the owner's call): the form only shows a notice. */
export function meta() {
  return [
    { title: 'Create an account — EduBud International' },
    { name: 'description', content: 'Create your EduBud account.' },
    { name: 'robots', content: 'noindex, nofollow' },
  ]
}

export default function Signup() {
  return (
    <AuthLayout
      title="Create an account"
      intro="For EduBud's volunteers, chapter leaders and central team."
      other={{ question: 'Already have an account?', link: 'Log in', to: '/login' }}
    >
      <SignupForm />
    </AuthLayout>
  )
}
