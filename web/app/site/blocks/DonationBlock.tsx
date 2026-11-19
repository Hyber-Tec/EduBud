import type { DonationBlock as Data } from '~/content/types'

/** The donation form, as the original draws it; it takes no payment yet (docs/DECISIONS.md §3). */
export function DonationBlock({ block }: { block: Data }) {
  void block
  return <div className="block donation-block" />
}
