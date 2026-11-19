import { FcGoogle } from 'react-icons/fc'
import { Button } from '~/components/ui/button'

/** "Continue with Google" or "Sign up with Google", with Google's own coloured G. */
export function GoogleButton({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <Button type="button" variant="outline" className="w-full" onClick={onClick}>
      <FcGoogle aria-hidden="true" />
      {children}
    </Button>
  )
}
