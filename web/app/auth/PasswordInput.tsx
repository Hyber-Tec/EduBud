import { useState } from 'react'
import { LuEye, LuEyeOff } from 'react-icons/lu'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '~/components/ui/input-group'

type Props = Omit<React.ComponentProps<'input'>, 'type'> & { id: string }

/** A password box with a button inside it that shows or hides what's typed. */
export function PasswordInput({ id, ...props }: Props) {
  const [visible, setVisible] = useState(false)
  return (
    <InputGroup>
      <InputGroupInput id={id} type={visible ? 'text' : 'password'} autoCapitalize="none" autoCorrect="off" spellCheck={false} {...props} />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-controls={id}
          onClick={() => setVisible(!visible)}
        >
          {visible ? <LuEyeOff aria-hidden="true" /> : <LuEye aria-hidden="true" />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}
