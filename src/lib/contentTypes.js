import { t } from './i18n'

// What each content type encodes. `primary` is the settings field the main
// input fills; types without one encode the main input text directly.
// Labels and placeholders are English and translated where they're shown.
export const CONTENT_TYPES = [
  { value: 'url', label: 'URL', placeholder: 'Paste a link…', inputMode: 'url' },
  { value: 'text', label: 'Text', placeholder: 'Type any text…' },
  { value: 'email', label: 'Email', placeholder: 'Email address…', inputMode: 'email', primary: 'emailTo' },
  { value: 'phone', label: 'Phone', placeholder: 'Phone number…', inputMode: 'tel' },
  { value: 'sms', label: 'SMS', placeholder: 'Phone number…', inputMode: 'tel', primary: 'smsNumber' },
  { value: 'whatsapp', label: 'WhatsApp', placeholder: 'Phone number with country code…', inputMode: 'tel', primary: 'waNumber' },
  { value: 'wifi', label: 'Wi-Fi', placeholder: 'Network name (SSID)…', primary: 'wifiSSID' },
  { value: 'contact', label: 'Contact', placeholder: 'Full name…', primary: 'contactName' },
  { value: 'event', label: 'Event', placeholder: 'Event title…', primary: 'eventTitle' },
  { value: 'location', label: 'Location', placeholder: 'Address or coordinates…', primary: 'locationQuery' },
  { value: 'sepa', label: 'Bank transfer', placeholder: 'Recipient name…', primary: 'sepaName' },
  { value: 'paypal', label: 'PayPal', placeholder: 'PayPal.Me username…', primary: 'paypalUser' },
  { value: 'crypto', label: 'Crypto', placeholder: 'Wallet address…', primary: 'cryptoAddress' },
]

export const contentTypeOf = (value) => CONTENT_TYPES.find(ct => ct.value === value) || CONTENT_TYPES[0]

export const CRYPTO_COINS = [
  { value: 'bitcoin', label: 'Bitcoin' },
  { value: 'ethereum', label: 'Ethereum' },
  { value: 'litecoin', label: 'Litecoin' },
  { value: 'solana', label: 'Solana' },
]

export const CONTENT_DEFAULTS = {
  // Email
  emailTo: '',
  emailSubject: '',
  emailBody: '',
  // SMS
  smsNumber: '',
  smsMessage: '',
  // WhatsApp
  waNumber: '',
  waMessage: '',
  // Wi-Fi
  wifiSSID: '',
  wifiPassword: '',
  wifiEncryption: 'WPA',
  wifiHidden: false,
  // Contact
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  contactOrg: '',
  contactUrl: '',
  // Event
  eventTitle: '',
  eventStart: '',
  eventEnd: '',
  eventLocation: '',
  // Location
  locationQuery: '',
  // Bank transfer (EPC / SEPA)
  sepaName: '',
  sepaIban: '',
  sepaBic: '',
  sepaAmount: '',
  sepaText: '',
  // PayPal
  paypalUser: '',
  paypalAmount: '',
  // Crypto
  cryptoCoin: 'bitcoin',
  cryptoAddress: '',
  cryptoAmount: '',
}

// The settings fields each type encodes (restored from recent codes).
const TYPE_FIELDS = {
  email: ['emailTo', 'emailSubject', 'emailBody'],
  sms: ['smsNumber', 'smsMessage'],
  whatsapp: ['waNumber', 'waMessage'],
  wifi: ['wifiSSID', 'wifiPassword', 'wifiEncryption', 'wifiHidden'],
  contact: ['contactName', 'contactPhone', 'contactEmail', 'contactOrg', 'contactUrl'],
  event: ['eventTitle', 'eventStart', 'eventEnd', 'eventLocation'],
  location: ['locationQuery'],
  sepa: ['sepaName', 'sepaIban', 'sepaBic', 'sepaAmount', 'sepaText'],
  paypal: ['paypalUser', 'paypalAmount'],
  crypto: ['cryptoCoin', 'cryptoAddress', 'cryptoAmount'],
}

export const fieldsOf = (type) => TYPE_FIELDS[type] || []

// All fields of a type back at their defaults, so switching content in
// doesn't keep leftovers (an old subject line, a previous amount).
export const blankFieldsOf = (type) =>
  Object.fromEntries(fieldsOf(type).map(key => [key, CONTENT_DEFAULTS[key]]))

const escapeWifi = (value) => value.replace(/([\\;,:"])/g, '\\$1')
// vCard / iCalendar text values
const escapeText = (value) => value.replace(/([\\;,])/g, '\\$1').replace(/\r?\n/g, '\\n')

// "2026-10-30T15:00" (datetime-local) → "20261030T150000" (floating local time)
const icsDate = (value) => value.replace(/[-:]/g, '').slice(0, 13).padEnd(15, '0')

function plusOneHour(value) {
  const d = new Date(value)
  d.setHours(d.getHours() + 1)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const COORDINATES = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/

// "12,5" → "12.50". Empty when blank or not a positive amount.
export function normalizeAmount(value, decimals = 2) {
  const v = String(value ?? '').replace(/\s/g, '').replace(',', '.')
  if (!new RegExp(`^\\d{1,12}(\\.\\d{1,${decimals}})?$`).test(v) || !(Number(v) > 0)) return ''
  return decimals === 2 ? Number(v).toFixed(2) : v.replace(/^0+(?=\d)/, '')
}

export const cleanIban = (value) => value.replace(/\s+/g, '').toUpperCase()

// ISO 13616 check digits (mod 97)
export function isValidIban(value) {
  const iban = cleanIban(value)
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false
  let rest = 0
  for (const ch of iban.slice(4) + iban.slice(0, 4)) {
    const digits = ch >= 'A' ? String(ch.charCodeAt(0) - 55) : ch
    for (const d of digits) rest = (rest * 10 + Number(d)) % 97
  }
  return rest === 1
}

export const cleanPaypalUser = (value) =>
  value.trim().replace(/^(https?:\/\/)?(www\.)?paypal\.me\//i, '').replace(/^@/, '').replace(/\/.*$/, '')

export function buildQRData(text, settings) {
  const s = settings
  switch (s.contentType) {
    case 'url':
      if (!text) return ''
      return /^(https?:|mailto:|tel:)/i.test(text) ? text : `https://${text}`
    case 'text':
      return text || ''
    case 'email': {
      if (!s.emailTo && !s.emailSubject && !s.emailBody) return ''
      const params = []
      if (s.emailSubject) params.push(`subject=${encodeURIComponent(s.emailSubject)}`)
      if (s.emailBody) params.push(`body=${encodeURIComponent(s.emailBody)}`)
      return `mailto:${s.emailTo}${params.length ? `?${params.join('&')}` : ''}`
    }
    case 'phone':
      return text ? `tel:${text.replace(/[^\d+]/g, '')}` : ''
    case 'sms': {
      const number = s.smsNumber.replace(/[^\d+]/g, '')
      if (!number) return ''
      return `SMSTO:${number}:${s.smsMessage}`
    }
    case 'whatsapp': {
      // wa.me wants digits only, international format without + or 00
      const number = s.waNumber.replace(/\D/g, '').replace(/^00/, '')
      if (!number && !s.waMessage) return ''
      const message = s.waMessage ? `?text=${encodeURIComponent(s.waMessage)}` : ''
      return `https://wa.me/${number}${message}`
    }
    case 'wifi': {
      if (!s.wifiSSID) return ''
      const enc = s.wifiEncryption === 'none' ? 'nopass' : s.wifiEncryption
      const password = enc === 'nopass' ? '' : `P:${escapeWifi(s.wifiPassword)};`
      const hidden = s.wifiHidden ? 'H:true;' : ''
      return `WIFI:T:${enc};S:${escapeWifi(s.wifiSSID)};${password}${hidden};`
    }
    case 'contact': {
      const name = s.contactName.trim()
      if (!name && !s.contactPhone && !s.contactEmail) return ''
      const parts = name.split(/\s+/).filter(Boolean)
      const family = parts.length > 1 ? parts.pop() : ''
      const lines = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `N:${escapeText(family)};${escapeText(parts.join(' '))};;;`,
        `FN:${escapeText(name)}`,
      ]
      if (s.contactOrg) lines.push(`ORG:${escapeText(s.contactOrg)}`)
      if (s.contactPhone) lines.push(`TEL;TYPE=CELL:${s.contactPhone.replace(/[^\d+]/g, '')}`)
      if (s.contactEmail) lines.push(`EMAIL:${escapeText(s.contactEmail)}`)
      if (s.contactUrl) lines.push(`URL:${escapeText(s.contactUrl)}`)
      lines.push('END:VCARD')
      return lines.join('\n')
    }
    case 'event': {
      if (!s.eventTitle || !s.eventStart) return ''
      const end = s.eventEnd && s.eventEnd > s.eventStart ? s.eventEnd : plusOneHour(s.eventStart)
      const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'BEGIN:VEVENT',
        `SUMMARY:${escapeText(s.eventTitle)}`,
        `DTSTART:${icsDate(s.eventStart)}`,
        `DTEND:${icsDate(end)}`,
      ]
      if (s.eventLocation) lines.push(`LOCATION:${escapeText(s.eventLocation)}`)
      lines.push('END:VEVENT', 'END:VCALENDAR')
      return lines.join('\n')
    }
    case 'location': {
      const query = s.locationQuery.trim()
      if (!query) return ''
      // A maps link opens on every phone; geo: URIs are ignored by iOS.
      const coords = query.match(COORDINATES)
      const q = coords ? `${coords[1]},${coords[2]}` : encodeURIComponent(query)
      return `https://www.google.com/maps/search/?api=1&query=${q}`
    }
    case 'sepa': {
      // EPC069-12 "GiroCode": read by most European banking apps.
      const name = s.sepaName.trim()
      const iban = cleanIban(s.sepaIban)
      if (!name || !iban) return ''
      const amount = normalizeAmount(s.sepaAmount)
      const lines = [
        'BCD', '002', '1', 'SCT',
        s.sepaBic.replace(/\s+/g, '').toUpperCase(),
        name.slice(0, 70),
        iban,
        amount ? `EUR${amount}` : '',
        '', '',
        s.sepaText.trim().slice(0, 140),
      ]
      while (lines[lines.length - 1] === '') lines.pop()
      return lines.join('\n')
    }
    case 'paypal': {
      const user = cleanPaypalUser(s.paypalUser)
      if (!user) return ''
      // "12,50" or "12.50 EUR"; without a currency PayPal uses the recipient's.
      const m = s.paypalAmount.trim().match(/^([\d.,\s]+?)\s*([a-z]{3})?$/i)
      const amount = m ? normalizeAmount(m[1]) : ''
      const currency = amount && m[2] ? m[2].toUpperCase() : ''
      return `https://paypal.me/${encodeURIComponent(user)}${amount ? `/${amount}${currency}` : ''}`
    }
    case 'crypto': {
      const address = s.cryptoAddress.trim()
      if (!address) return ''
      const amount = normalizeAmount(s.cryptoAmount, 18)
      if (!amount) return `${s.cryptoCoin}:${address}`
      // EIP-681 takes the amount in wei; scientific notation is allowed.
      return s.cryptoCoin === 'ethereum'
        ? `ethereum:${address}?value=${amount}e18`
        : `${s.cryptoCoin}:${address}?amount=${amount}`
    }
    default:
      return text || ''
  }
}

const shorten = (value) => (value.length > 15 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value)

// A short, readable line for the encoded content (shown under the code and
// as a print caption) instead of raw vCard / calendar / Wi-Fi syntax.
export function describeQRData(settings, data) {
  const s = settings
  switch (s.contentType) {
    case 'email': return s.emailTo ? t('Email {to}', { to: s.emailTo }) : t('Email')
    case 'phone': return t('Call {number}', { number: data.replace(/^tel:/, '') })
    case 'sms': return t('SMS {number}', { number: s.smsNumber })
    case 'whatsapp': return s.waNumber ? t('WhatsApp {number}', { number: s.waNumber }) : t('WhatsApp message')
    case 'wifi': return t('Wi-Fi {name}', { name: s.wifiSSID })
    case 'contact': return s.contactName || s.contactPhone || s.contactEmail
    case 'event': {
      const when = new Date(s.eventStart)
      const date = Number.isNaN(when.getTime()) ? '' : ` · ${when.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`
      return `${s.eventTitle}${date}`
    }
    case 'location': return s.locationQuery
    case 'sepa': {
      const amount = normalizeAmount(s.sepaAmount)
      const money = amount ? ` · ${Number(amount).toLocaleString(undefined, { style: 'currency', currency: 'EUR' })}` : ''
      return `${t('Transfer to {name}', { name: s.sepaName.trim() })}${money}`
    }
    case 'paypal': return `PayPal ${cleanPaypalUser(s.paypalUser)}`
    case 'crypto': {
      const coin = CRYPTO_COINS.find(c => c.value === s.cryptoCoin)?.label || ''
      return `${coin} ${shorten(s.cryptoAddress.trim())}`
    }
    default: return data
  }
}
