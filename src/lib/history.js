import { fieldsOf } from './contentTypes'

// Recently used codes, kept on this device only. An entry stores what's
// needed to bring the code back: its type, the main input text and the
// type's fields. Never the Wi-Fi password, same as the saved settings —
// which is also why the encoded data itself (it contains the password) is
// not stored.

const STORAGE_KEY = 'quickqr:history'
const MAX_ENTRIES = 12
const SECRET_FIELDS = ['wifiPassword']

export function loadHistory() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return Array.isArray(stored)
      ? stored.filter(e => e && typeof e.key === 'string' && typeof e.contentType === 'string' && e.fields).slice(0, MAX_ENTRIES)
      : []
  } catch {
    return []
  }
}

function save(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Storage full or blocked — history stays in memory for this visit.
  }
}

// Returns the new list (newest first, one entry per content).
export function addToHistory(entries, { settings, text, label }) {
  const contentType = settings.contentType
  const fields = Object.fromEntries(
    fieldsOf(contentType)
      .filter(key => !SECRET_FIELDS.includes(key))
      .map(key => [key, settings[key]]),
  )
  const key = JSON.stringify([contentType, text || '', fields])
  const entry = { key, contentType, text: text || '', fields, label: label || text || '', at: Date.now() }
  const next = [entry, ...entries.filter(e => e.key !== key)].slice(0, MAX_ENTRIES)
  save(next)
  return next
}

export function removeFromHistory(entries, key) {
  const next = entries.filter(e => e.key !== key)
  save(next)
  return next
}

export function clearHistory() {
  save([])
  return []
}
