/**
 * The "Add To Cart" button, drawn and dimmed on hover like the original's. Buying does nothing yet (the owner's
 * decision, docs/DECISIONS.md §3): pressing it adds nothing and opens nothing.
 */
export function AddToCartButton({ label, className = '' }: { label: string; className?: string }) {
  return (
    <button type="button" className={`shop-button ${className}`}>
      <span className="shop-button-inner">
        <span className="shop-button-text">{label}</span>
      </span>
    </button>
  )
}
