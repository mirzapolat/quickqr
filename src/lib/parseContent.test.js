import { describe, expect, it } from 'vitest'
import { buildQRData, blankFieldsOf, isValidIban, normalizeAmount } from './contentTypes'
import { parseQRData } from './parseContent'
import { DEFAULT_SETTINGS } from '../hooks/useQRSettings'

// Build a code, read it back, build again: the content must survive.
function roundTrip(contentType, fields = {}, text = '') {
  const settings = { ...DEFAULT_SETTINGS, contentType, ...fields }
  const data = buildQRData(text, settings)
  const parsed = parseQRData(data)
  expect(parsed.contentType).toBe(contentType)
  const restored = { ...DEFAULT_SETTINGS, contentType, ...blankFieldsOf(contentType), ...parsed.fields }
  expect(buildQRData(parsed.text ?? '', restored)).toBe(data)
  return parsed
}

describe('round trips', () => {
  it('url', () => roundTrip('url', {}, 'https://example.com/a?b=c'))
  it('text', () => roundTrip('text', {}, 'Hello there, friend'))
  it('phone', () => roundTrip('phone', {}, '+49 151 2345678'))
  it('email', () => roundTrip('email', { emailTo: 'a@b.de', emailSubject: 'Hi & bye', emailBody: 'Line 1\nLine 2' }))
  it('sms', () => roundTrip('sms', { smsNumber: '+491512345678', smsMessage: 'Time: 10:30' }))
  it('whatsapp', () => roundTrip('whatsapp', { waNumber: '491512345678', waMessage: 'Hallo & tschüss?' }))
  it('wifi with escapes', () => {
    const parsed = roundTrip('wifi', { wifiSSID: 'Home;Net:5G', wifiPassword: 'p@ss\\word;"x"', wifiEncryption: 'WPA', wifiHidden: true })
    expect(parsed.fields.wifiPassword).toBe('p@ss\\word;"x"')
  })
  it('open wifi', () => roundTrip('wifi', { wifiSSID: 'Cafe', wifiEncryption: 'none' }))
  it('contact', () => roundTrip('contact', {
    contactName: 'Ada King Lovelace', contactPhone: '+44 20 1234', contactEmail: 'ada@example.com',
    contactOrg: 'Analytical, Ltd.', contactUrl: 'https://ada.example',
  }))
  it('event', () => roundTrip('event', {
    eventTitle: 'Launch; party, yes', eventStart: '2026-11-05T18:30', eventEnd: '2026-11-05T22:00', eventLocation: 'Berlin',
  }))
  it('location', () => roundTrip('location', { locationQuery: 'Alexanderplatz, Berlin' }))
  it('coordinates', () => roundTrip('location', { locationQuery: '52.52, 13.405' }))
  it('sepa', () => {
    const parsed = roundTrip('sepa', {
      sepaName: 'Red Cross', sepaIban: 'DE89 3704 0044 0532 0130 00', sepaBic: 'COBADEFFXXX',
      sepaAmount: '12,5', sepaText: 'Donation',
    })
    expect(parsed.fields.sepaAmount).toBe('12.50')
  })
  it('sepa without amount', () => roundTrip('sepa', { sepaName: 'Jane', sepaIban: 'DE89370400440532013000' }))
  it('paypal', () => roundTrip('paypal', { paypalUser: 'janedoe', paypalAmount: '9.99 EUR' }))
  it('bitcoin', () => roundTrip('crypto', { cryptoCoin: 'bitcoin', cryptoAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', cryptoAmount: '0.001' }))
  it('ethereum', () => roundTrip('crypto', { cryptoCoin: 'ethereum', cryptoAddress: '0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7', cryptoAmount: '1.5' }))
})

describe('codes made elsewhere', () => {
  it('reads a MECARD', () => {
    expect(parseQRData('MECARD:N:Doe,John;TEL:123;EMAIL:j@d.com;;').fields)
      .toMatchObject({ contactName: 'John Doe', contactPhone: '123', contactEmail: 'j@d.com' })
  })
  it('reads UTC event times as local time', () => {
    const { fields } = parseQRData('BEGIN:VEVENT\nSUMMARY:X\nDTSTART:20261105T120000Z\nEND:VEVENT')
    const local = new Date(Date.UTC(2026, 10, 5, 12, 0))
    expect(fields.eventStart).toBe(`2026-11-05T${String(local.getHours()).padStart(2, '0')}:00`)
  })
  it('reads sms: URIs and geo:', () => {
    expect(parseQRData('sms:+123?body=Hi%20there').fields).toEqual({ smsNumber: '+123', smsMessage: 'Hi there' })
    expect(parseQRData('geo:52.5,13.4').fields.locationQuery).toBe('52.5, 13.4')
  })
  it('treats bare domains as links and anything else as text', () => {
    expect(parseQRData('example.com/x')).toEqual({ contentType: 'url', text: 'example.com/x' })
    expect(parseQRData('just words')).toEqual({ contentType: 'text', text: 'just words' })
  })
})

describe('helpers', () => {
  it('checks IBANs', () => {
    expect(isValidIban('DE89 3704 0044 0532 0130 00')).toBe(true)
    expect(isValidIban('DE89 3704 0044 0532 0130 01')).toBe(false)
  })
  it('normalizes amounts', () => {
    expect(normalizeAmount('12,5')).toBe('12.50')
    expect(normalizeAmount('0')).toBe('')
    expect(normalizeAmount('abc')).toBe('')
  })
})
