/** Hira mark: the letter H in the accent circle. The name stays Hira's own. */
export function HiraLogo({ className = 'size-icon' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="12" className="fill-accent" />
      <path d="M7.5 6.5v11M16.5 6.5v11M7.5 12h9" fill="none" strokeWidth="2.4" strokeLinecap="round" className="stroke-on-accent" />
    </svg>
  );
}
