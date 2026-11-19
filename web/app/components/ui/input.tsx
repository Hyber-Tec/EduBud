import { cn } from 'cn'
import type * as React from 'react'

// shadcn/ui's input, in EduBud's look: a pill like the buttons, 44px tall, 16px text (phones don't zoom in on it). On
// focus its border turns near-black inside a mint ring; with an error, its border is red (what's typed stays
// near-black, though the field's label and message turn red).
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-11 w-full min-w-0 rounded-full border border-input bg-background px-4 text-base font-light text-foreground transition-[color,border-color,box-shadow] outline-hidden file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-bold file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-mint disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
