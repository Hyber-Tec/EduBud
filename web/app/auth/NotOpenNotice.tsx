import { useEffect, useRef } from 'react'
import { LuInfo } from 'react-icons/lu'
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'

/**
 * Says that accounts aren't open yet. For now (the owner's call) these pages sign no one in and send nothing anywhere:
 * every button shows this instead. `shown` counts the times it was asked for, so it's read out again each time.
 *
 * The box around it is a live region that's there from the start, empty: screen readers only read what appears in
 * one that already exists. The notice inside is a plain box, so it isn't read twice.
 */
export function NotOpenNotice({ shown, title }: { shown: number; title: string }) {
  const box = useRef<HTMLDivElement>(null)
  // On a phone the notice may be above the screen when the button below is pressed: bring it into view.
  useEffect(() => {
    if (shown) box.current?.scrollIntoView({ block: 'nearest' })
  }, [shown])

  return (
    <div ref={box} role="status">
      {shown > 0 && (
        <Alert key={shown} role="none" className="mb-6 border-dark-green/40 bg-accent text-foreground *:[svg]:text-near-black">
          <LuInfo aria-hidden="true" />
          <AlertTitle>{title}</AlertTitle>
          <AlertDescription className="text-foreground">We're still building EduBud's accounts. Nothing you entered was sent anywhere.</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
