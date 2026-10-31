import { CRYPTO_COINS } from './contentTypes'

// Turns the text inside a scanned QR code back into a content type and its
// fields, so an existing code can be edited and restyled. Returns
// { contentType, fields } for multi-field types and { contentType, text }
// for types the main input holds (URL, text, phone).

const decode = (value) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

// Query strings may encode spaces as "+"; paths and numbers keep their "+".
const decodeQuery = (value) => decode(value.replace(/\+/g, ' '))

function queryOf(uri) {
  const i = uri.indexOf('?')
  const params = {}
  if (i < 0) return params
  for (const pair of uri.slice(i + 1).split('&')) {
    const [key, ...rest] = pair.split('=')
    if (key) params[key.toLowerCase()] = decodeQuery(rest.join('='))
  }
  return params
}

// "T:WPA;S:Home\;Net;;" → { T: 'WPA', S: 'Home;Net' } (Wi-Fi, MECARD, MATMSG)
function splitFields(body) {
  const fields = {}
  let segment = ''
  const flush = () => {
    const colon = segment.indexOf(':')
    if (colon > 0) {
      const key = segment.slice(0, colon).toUpperCase()
      if (!(key in fields)) fields[key] = segment.slice(colon + 1).replace(/\\(.)/g, '$1')
    }
    segment = ''
  }
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (c === '\\' && i + 1 < body.length) {
      segment += c + body[++i]
    } else if (c === ';') {
      flush()
    } else {
      segment += c
    }
  }
  flush()
  return fields
}

// vCard / iCalendar: unfold continuation lines, then NAME;PARAMS:VALUE
function readProperties(text) {
  const props = {}
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n')
  for (const line of lines) {
    const colon = line.indexOf(':')
    if (colon < 1) continue
    const name = line.slice(0, colon).split(';')[0].replace(/^[^.]+\./, '').toUpperCase()
    if (!(name in props)) props[name] = line.slice(colon + 1)
  }
  return props
}

const unescapeText = (value = '') =>
  value.replace(/\\n/gi, '\n').replace(/\\([\\;,:])/g, '$1')

// "20261030T150000" / "…Z" (UTC) / "20261030" → "2026-10-30T15:00" (local)
function fromIcsDate(value = '') {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/)
  if (!m) return ''
  const [, y, mo, d, h = '00', mi = '00', , utc] = m
  if (!utc) return `${y}-${mo}-${d}T${h}:${mi}`
  const date = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi))
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function parseWifi(body) {
  const f = splitFields(body)
  const type = (f.T || '').toUpperCase()
  const encryption = type === 'WEP' ? 'WEP' : !type || type === 'NOPASS' ? 'none' : 'WPA'
  return {
    contentType: 'wifi',
    fields: {
      wifiSSID: f.S || '',
      wifiPassword: encryption === 'none' ? '' : f.P || '',
      wifiEncryption: encryption,
      wifiHidden: /^true$/i.test(f.H || ''),
    },
  }
}

function parseVCard(text) {
  const p = readProperties(text)
  let name = unescapeText(p.FN).trim()
  if (!name && p.N) {
    const [family = '', given = ''] = p.N.split(';').map(unescapeText)
    name = `${given} ${family}`.trim()
  }
  return {
    contentType: 'contact',
    fields: {
      contactName: name,
      contactPhone: (p.TEL || '').replace(/^tel:/i, ''),
      contactEmail: unescapeText(p.EMAIL),
      contactOrg: unescapeText((p.ORG || '').split(/(?<!\\);/)[0]),
      contactUrl: unescapeText(p.URL),
    },
  }
}

function parseMeCard(body) {
  const f = splitFields(body)
  const [family = '', given = ''] = (f.N || '').split(',')
  return {
    contentType: 'contact',
    fields: {
      contactName: `${given} ${family}`.trim(),
      contactPhone: f.TEL || '',
      contactEmail: f.EMAIL || '',
      contactOrg: f.ORG || '',
      contactUrl: f.URL || '',
    },
  }
}

function parseEvent(text) {
  const p = readProperties(text)
  return {
    contentType: 'event',
    fields: {
      eventTitle: unescapeText(p.SUMMARY),
      eventStart: fromIcsDate(p.DTSTART),
      eventEnd: fromIcsDate(p.DTEND),
      eventLocation: unescapeText(p.LOCATION),
    },
  }
}

function parseSepa(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').map(line => line.trim())
  if (lines[3] !== 'SCT') return null
  return {
    contentType: 'sepa',
    fields: {
      sepaBic: lines[4] || '',
      sepaName: lines[5] || '',
      sepaIban: lines[6] || '',
      sepaAmount: (lines[7] || '').replace(/^EUR/i, ''),
      sepaText: lines[10] || lines[9] || '',
    },
  }
}

function parseCrypto(text) {
  const m = text.match(/^([a-z]+):(?:pay-)?([^?@/]+)/i)
  const coin = m && CRYPTO_COINS.find(c => c.value === m[1].toLowerCase())
  if (!coin) return null
  const q = queryOf(text)
  let amount = q.amount || ''
  if (coin.value === 'ethereum' && q.value) {
    const value = q.value.toLowerCase()
    amount = value.endsWith('e18') ? value.slice(0, -3) : String(Number(value) / 1e18)
  }
  return {
    contentType: 'crypto',
    fields: { cryptoCoin: coin.value, cryptoAddress: m[2], cryptoAmount: amount },
  }
}

function parseHttp(text) {
  let url
  try {
    url = new URL(text)
  } catch {
    return { contentType: 'url', text }
  }
  const host = url.hostname.replace(/^www\./, '').toLowerCase()
  const q = Object.fromEntries([...url.searchParams].map(([k, v]) => [k.toLowerCase(), v]))

  if (host === 'wa.me') {
    return { contentType: 'whatsapp', fields: { waNumber: url.pathname.replace(/\D/g, ''), waMessage: q.text || '' } }
  }
  if (host === 'api.whatsapp.com' && url.pathname.startsWith('/send')) {
    return { contentType: 'whatsapp', fields: { waNumber: (q.phone || '').replace(/\D/g, ''), waMessage: q.text || '' } }
  }
  if (host === 'paypal.me') {
    const [user = '', amount = ''] = url.pathname.split('/').filter(Boolean).map(decode)
    if (user) {
      const m = amount.match(/^([\d.]+)([a-z]{3})?$/i)
      return {
        contentType: 'paypal',
        fields: { paypalUser: user, paypalAmount: m ? [m[1], m[2]?.toUpperCase()].filter(Boolean).join(' ') : '' },
      }
    }
  }
  const isGoogleMaps = host === 'maps.google.com' || (host === 'google.com' && url.pathname.startsWith('/maps'))
  if (isGoogleMaps && (q.query || q.q)) {
    return { contentType: 'location', fields: { locationQuery: (q.query || q.q).replace(/^(-?[\d.]+),(-?[\d.]+)$/, '$1, $2') } }
  }
  if (host === 'maps.apple.com' && (q.q || q.ll)) {
    return { contentType: 'location', fields: { locationQuery: q.q || q.ll.replace(',', ', ') } }
  }
  return { contentType: 'url', text }
}

export function parseQRData(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return { contentType: 'text', text: '' }
  const upper = text.slice(0, 16).toUpperCase()

  if (upper.startsWith('WIFI:')) return parseWifi(text.slice(5))
  if (upper.startsWith('BEGIN:VCARD')) return parseVCard(text)
  if (upper.startsWith('MECARD:')) return parseMeCard(text.slice(7))
  if (upper.startsWith('BEGIN:VCALENDAR') || upper.startsWith('BEGIN:VEVENT')) return parseEvent(text)
  if (/^BCD\r?\n/.test(upper)) {
    const sepa = parseSepa(text)
    if (sepa) return sepa
  }

  if (/^mailto:/i.test(text)) {
    const q = queryOf(text)
    const to = decode(text.slice(7).split('?')[0])
    return { contentType: 'email', fields: { emailTo: to, emailSubject: q.subject || '', emailBody: q.body || '' } }
  }
  if (upper.startsWith('MATMSG:')) {
    const f = splitFields(text.slice(7))
    return { contentType: 'email', fields: { emailTo: f.TO || '', emailSubject: f.SUB || '', emailBody: f.BODY || '' } }
  }
  if (upper.startsWith('SMSTO:')) {
    const [number = '', ...message] = text.slice(6).split(':')
    return { contentType: 'sms', fields: { smsNumber: number, smsMessage: message.join(':') } }
  }
  if (/^sms:/i.test(text)) {
    const number = text.slice(4).split(/[?;]/)[0]
    return { contentType: 'sms', fields: { smsNumber: decode(number), smsMessage: queryOf(text).body || '' } }
  }
  if (/^tel:/i.test(text)) return { contentType: 'phone', text: decode(text.slice(4)) }
  if (/^geo:/i.test(text)) {
    const [lat, lng] = text.slice(4).split(/[,;?]/)
    if (lat && lng) return { contentType: 'location', fields: { locationQuery: `${lat}, ${lng}` } }
  }

  const crypto = parseCrypto(text)
  if (crypto) return crypto

  if (/^https?:\/\//i.test(text)) return parseHttp(text)
  // A bare domain ("example.com/page") is still a link.
  if (/^[\w-]+(\.[\w-]+)*\.[a-z]{2,}(\/\S*)?$/i.test(text)) return { contentType: 'url', text }
  return { contentType: 'text', text }
}
