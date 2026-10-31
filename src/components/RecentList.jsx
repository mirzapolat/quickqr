import { contentTypeOf } from '../lib/contentTypes'
import { t } from '../lib/i18n'

const VISIBLE = 5

// Shown under the input while it's empty and nothing is generated, so it
// never competes with a code on screen.
export default function RecentList({ entries, onPick, onRemove, onClear }) {
  if (!entries.length) return null
  return (
    <section className="recent" aria-label={t('Recent codes')}>
      <div className="recent-head">
        <span className="section-label">{t('Recent')}</span>
        <button className="link-btn" onClick={onClear}>{t('Clear')}</button>
      </div>
      <ul className="recent-list">
        {entries.slice(0, VISIBLE).map(entry => (
          <li key={entry.key} className="recent-item">
            <button className="recent-pick" onClick={() => onPick(entry)} title={entry.label}>
              <span className="recent-type">{t(contentTypeOf(entry.contentType).label)}</span>
              <span className="recent-label">{entry.label}</span>
            </button>
            <button className="recent-remove" onClick={() => onRemove(entry)} aria-label={t('Remove {label}', { label: entry.label })}>
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
