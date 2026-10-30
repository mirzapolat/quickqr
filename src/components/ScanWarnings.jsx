export default function ScanWarnings({ warnings, onFix }) {
  if (!warnings.length) return null
  return (
    <ul className="scan-warnings" aria-label="Scan warnings">
      {warnings.map(warning => (
        <li key={warning.id} className="scan-warning">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 1.75 15 14H1L8 1.75Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
            <path d="M8 6.5v3.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="8" cy="11.75" r=".85" fill="currentColor"/>
          </svg>
          <span>{warning.message}</span>
          {warning.fix && (
            <button className="warning-fix" onClick={() => onFix(warning.fix.patch)}>
              {warning.fix.label}
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
