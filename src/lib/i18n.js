import DE from '../locales/de'

// UI text is written in English and looked up by that text, so components
// stay readable: t('Copied as {format}', { format: 'PNG' }).

export const LANGUAGES = [
  { value: 'auto', label: 'Auto' },
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
]

const DICTIONARIES = { de: DE }
const STORAGE_KEY = 'quickqr:language'

function readPreference() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return LANGUAGES.some(l => l.value === stored) ? stored : 'auto'
  } catch {
    return 'auto'
  }
}

function resolve(preference) {
  if (preference !== 'auto') return preference
  const nav = typeof navigator === 'undefined' ? {} : navigator
  const wanted = nav.languages?.length ? nav.languages : [nav.language || 'en']
  for (const tag of wanted) {
    const base = String(tag).toLowerCase().split('-')[0]
    if (base === 'en' || DICTIONARIES[base]) return base
  }
  return 'en'
}

let preference = readPreference()
let language = resolve(preference)
if (typeof document !== 'undefined') document.documentElement.lang = language

export const getLanguage = () => language
export const getLanguagePreference = () => preference

export function setLanguagePreference(value) {
  preference = LANGUAGES.some(l => l.value === value) ? value : 'auto'
  language = resolve(preference)
  document.documentElement.lang = language
  try {
    if (preference === 'auto') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    // Storage unavailable — the choice lasts for this visit.
  }
}

export function t(text, vars) {
  const translated = DICTIONARIES[language]?.[text] ?? text
  if (!vars) return translated
  return translated.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match))
}

// "1 code" / "3 codes" — pass the English singular and plural.
export const plural = (count, one, other) => t(count === 1 ? one : other, { count })
