import { useState } from 'react'

const MIN = 1
const MAX = 9999

/**
 * The quantity field beside "Add To Cart": − and + buttons around the number, as the original's (− is dimmed at 1).
 * It counts, but buying does nothing yet (docs/DECISIONS.md §3), so the number goes nowhere.
 */
export function Quantity() {
  const [value, setValue] = useState(String(MIN))
  const n = Number(value) || MIN
  const set = (next: number) => setValue(String(Math.min(MAX, Math.max(MIN, next))))
  return (
    <div className="shop-qty">
      <div className="shop-qty-input shop-size" role="group" aria-label="Quantity">
        <button type="button" className="shop-qty-button" aria-label="Decrease quantity by 1" disabled={n <= MIN} onClick={() => set(n - 1)}>
          <span className="shop-qty-icon">
            <svg fill="currentColor" width="17" height="17" viewBox="0 0 22 22" aria-hidden="true">
              <path d="M3 10h17v2H3z" />
            </svg>
          </span>
        </button>
        <input
          name="quantity-input"
          type="number"
          value={value}
          min={MIN}
          max={MAX}
          size={4}
          autoComplete="off"
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => set(n)}
        />
        <button type="button" className="shop-qty-button" aria-label="Increase quantity by 1" disabled={n >= MAX} onClick={() => set(n + 1)}>
          <span className="shop-qty-icon">
            {/* A plus, drawn as one outline (two overlapping bars would blur its centre differently). */}
            <svg fill="currentColor" width="17" height="17" viewBox="0 0 22 22" aria-hidden="true">
              <path d="M10 3h2v7h7v2h-7v7h-2v-7H3v-2h7z" />
            </svg>
          </span>
        </button>
      </div>
      <span className="shop-qty-effects" aria-hidden="true">
        <span className="shop-qty-border" />
      </span>
    </div>
  )
}
