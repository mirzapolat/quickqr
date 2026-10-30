// What each content type encodes. `primary` is the settings field the main
// input fills; types without one encode the main input text directly.
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
]

export const contentTypeOf = (value) => CONTENT_TYPES.find(ct => ct.value === value) || CONTENT_TYPES[0]

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
}

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
    default:
      return text || ''
  }
}

// A short, readable line for the encoded content (shown under the code and
// as a print caption) instead of raw vCard / calendar / Wi-Fi syntax.
export function describeQRData(settings, data) {
  const s = settings
  switch (s.contentType) {
    case 'email': return s.emailTo ? `Email ${s.emailTo}` : 'Email'
    case 'phone': return data.replace(/^tel:/, 'Call ')
    case 'sms': return `SMS ${s.smsNumber}`
    case 'whatsapp': return s.waNumber ? `WhatsApp ${s.waNumber}` : 'WhatsApp message'
    case 'wifi': return `Wi-Fi ${s.wifiSSID}`
    case 'contact': return s.contactName || s.contactPhone || s.contactEmail
    case 'event': {
      const when = new Date(s.eventStart)
      const date = Number.isNaN(when.getTime()) ? '' : ` · ${when.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`
      return `${s.eventTitle}${date}`
    }
    case 'location': return s.locationQuery
    default: return data
  }
}
