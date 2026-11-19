import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { DonationBlock as Data } from '~/content/types'
import widgets from '~/content/widgets.json'
import { SubmitButton, type SubmitState } from './SubmitButton'

/** The donation form's settings, as scripts/capture/widgets.ts read them from the original's block. */
interface DonationWidget {
  buttonText: string
  buttonAlignment: string
  fund: {
    customAmount: boolean
    amounts: { cents: number; label: string }[]
    frequencies: string[]
    defaultFrequency: string
    coverTheFee?: { percent: number; description: string; label: string; checked: boolean }
  }
  currency: string
  locale: string
  strings: Record<string, string>
}

const FREQUENCY_LABEL: Record<string, string> = {
  ONE_TIME: 'oneTimeDonationLabel',
  WEEKLY: 'weeklyDonationLabel',
  MONTHLY: 'monthlyDonationLabel',
  QUARTERLY: 'quarterlyDonationLabel',
  ANNUALLY: 'annualDonationLabel',
}
const TOTAL_LABEL: Record<string, string> = {
  ONE_TIME: 'totalAmountOneTimeLabel',
  WEEKLY: 'totalAmountWeeklyLabel',
  MONTHLY: 'totalAmountMonthlyLabel',
  QUARTERLY: 'totalAmountQuarterlyLabel',
  ANNUALLY: 'totalAmountAnnualLabel',
}
const CUSTOM = 'custom'

/** How long the button shows its "submitting" line, about as long as the original takes to answer. */
const SUBMIT_MS = 900

/**
 * The donation form, as the original draws it: the suggested amounts and a custom one, how often, covering the fee,
 * the total, and Donate. It takes no money (docs/DECISIONS.md §3): Donate shows the original's first response, the
 * button's "submitting" line (and, with no amount, the original's error), and goes no further. Nothing is sent.
 */
export function DonationBlock({ block }: { block: Data }) {
  const w = (widgets.donation as Record<string, DonationWidget>)[block.id]
  const uid = useId()
  const [choice, setChoice] = useState<string>(String(w?.fund.amounts[0]?.cents ?? CUSTOM))
  const [custom, setCustom] = useState('')
  const [frequency, setFrequency] = useState(w?.fund.defaultFrequency ?? 'ONE_TIME')
  const [coverFee, setCoverFee] = useState(w?.fund.coverTheFee?.checked ?? false)
  const [state, setState] = useState<SubmitState>('none')
  const [error, setError] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  if (!w) return <div className="block donation-block" />

  const s = w.strings
  const money = new Intl.NumberFormat(w.locale, { style: 'currency', currency: w.currency })
  const amount = choice === CUSTOM ? Math.max(0, Math.round((parseFloat(custom.replace(/[^\d.]/g, '')) || 0) * 100)) : Number(choice)
  const fee = w.fund.coverTheFee && coverFee ? Math.round((amount * w.fund.coverTheFee.percent) / 100) : 0

  function submit(e: FormEvent) {
    e.preventDefault()
    if (state === 'submitting') return
    setState('submitting')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      // The original's server refuses an empty amount (its error, and the button shakes); any other donation would
      // leave for Squarespace's checkout, which ours doesn't have, so the button simply comes back.
      setError(amount <= 0)
      setState(amount <= 0 ? 'error' : 'none')
    }, SUBMIT_MS)
  }

  return (
    <div className="block donation-block">
      <form className="donation-form" autoComplete="on" noValidate onSubmit={submit}>
        {error && (
          <div className="donation-error">
            <p className="donation-error-text" role="alert">
              <svg className="donation-error-icon" width="15" height="15" viewBox="0 0 14 14" aria-hidden="true">
                <circle cx="7" cy="7" r="6.22" fill="none" stroke="currentColor" strokeWidth="1.56" />
                <path d="M6.22 3.11h1.56v5.44H6.22zM6.22 9.33h1.56v1.56H6.22z" fill="currentColor" />
              </svg>
              {s.submitError}
            </p>
          </div>
        )}
        <fieldset className="donation-amounts">
          <legend className="donation-legend" />
          {w.fund.amounts.map((a) => (
            <Choice key={a.cents} name={`${uid}-amount`} value={String(a.cents)} label={a.label} checked={choice === String(a.cents)} onChange={setChoice} />
          ))}
          {w.fund.customAmount && <Choice name={`${uid}-amount`} value={CUSTOM} label={s.customAmountLabel} checked={choice === CUSTOM} onChange={setChoice} />}
        </fieldset>
        {choice === CUSTOM && (
          <div className="donation-field donation-field--amount">
            <label className="donation-field-title" htmlFor={`${uid}-custom`}>
              <span className="donation-field-title-row">
                <span>{s.customAmountDescription}</span>
                <span className="donation-required">{s.required}</span>
              </span>
            </label>
            <input
              id={`${uid}-custom`}
              className="donation-input"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              placeholder={s.customAmountLabel}
              aria-required="true"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
            <span className="donation-fill" aria-hidden="true" />
            <span className="donation-prefix" aria-hidden="true">
              {money.formatToParts(0).find((p) => p.type === 'currency')?.value ?? '$'}
            </span>
          </div>
        )}
        <div className="donation-field donation-field--frequency">
          <select className="donation-select" aria-label={s.donationFrequencyDropdownAriaLabel} value={frequency} onChange={(e) => setFrequency(e.target.value)}>
            {w.fund.frequencies.map((f) => (
              <option key={f} value={f}>
                {s[FREQUENCY_LABEL[f]] ?? f}
              </option>
            ))}
          </select>
          <span className="donation-fill" aria-hidden="true" />
          <svg className="donation-chevron" width="18" height="12" viewBox="0 0 18 12" aria-hidden="true">
            <polygon points="0.44,1.5 1.56,0.5 9,8.87 16.44,0.5 17.56,1.5 9,11.13" fill="currentColor" />
          </svg>
        </div>
        {w.fund.coverTheFee && (
          <fieldset className="donation-fee">
            <legend className="donation-legend" />
            <div className="donation-fee-option">
              <label>
                <input className="donation-checkbox" type="checkbox" checked={coverFee} onChange={(e) => setCoverFee(e.target.checked)} />
                <span>{w.fund.coverTheFee.description}</span>
              </label>
            </div>
          </fieldset>
        )}
        <div className="donation-total">
          {w.fund.coverTheFee && coverFee && (
            <>
              <span>{w.fund.coverTheFee.label}</span>
              <span className="donation-total-amount">{money.format(fee / 100)}</span>
            </>
          )}
          <span className="donation-total-sum">{s[TOTAL_LABEL[frequency]] ?? s.totalAmountOneTimeLabel}</span>
          <span className="donation-total-amount donation-total-sum">{money.format((amount + fee) / 100)}</span>
        </div>
        <div className={`donation-button-wrap donation-button-wrap--${w.buttonAlignment}`}>
          <SubmitButton label={w.buttonText} busyLabel={s.submissionLabel} state={state} className="donation-button" />
        </div>
      </form>
    </div>
  )
}

/** One amount: a pill that is a radio button. */
function Choice({ name, value, label, checked, onChange }: { name: string; value: string; label: string; checked: boolean; onChange: (v: string) => void }) {
  return (
    <div className="donation-option">
      <label>
        <input type="radio" name={name} value={value} checked={checked} onChange={() => onChange(value)} />
        <span className="donation-pill">{label}</span>
      </label>
    </div>
  )
}
