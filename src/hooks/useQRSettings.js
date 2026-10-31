import { useState, useCallback, useEffect } from 'react'
import { CONTENT_DEFAULTS, CONTENT_TYPES, CRYPTO_COINS } from '../lib/contentTypes'

export const DEFAULT_SETTINGS = {
  contentType: 'url',
  dotStyle: 'square',
  cornerStyle: 'match',
  fgColor: '#000000',
  bgColor: '#ffffff',
  gradient: 'none',
  fgColor2: '#2f6fed',
  frame: 'none',
  // Empty shows the translated default ("Scan me")
  frameText: '',
  errorCorrection: 'M',
  size: 300,
  margin: 10,
  logoUrl: null,
  // Logo width as a share of the code width; capped by error correction
  logoSize: 0.22,
  downloadFormat: 'png',
  ...CONTENT_DEFAULTS,
}

// The look of a code, without its content. Shared through style links.
export const STYLE_KEYS = [
  'dotStyle', 'cornerStyle', 'fgColor', 'bgColor', 'gradient', 'fgColor2', 'frame', 'frameText',
  'errorCorrection', 'size', 'margin', 'logoSize', 'downloadFormat',
]

const STORAGE_KEY = 'quickqr:settings'
// Never write the Wi-Fi password to disk.
const NON_PERSISTED_KEYS = ['wifiPassword']

const ALLOWED = {
  contentType: CONTENT_TYPES.map(ct => ct.value),
  dotStyle: ['square', 'rounded', 'dots'],
  cornerStyle: ['match', 'square', 'rounded', 'circle'],
  gradient: ['none', 'linear', 'radial'],
  frame: ['none', 'caption', 'badge'],
  cryptoCoin: CRYPTO_COINS.map(c => c.value),
  errorCorrection: ['L', 'M', 'Q', 'H'],
  downloadFormat: ['png', 'svg', 'jpeg', 'webp'],
  wifiEncryption: ['WPA', 'WEP', 'none'],
}
const RANGES = { size: [200, 600], margin: [0, 100], logoSize: [0.1, 0.5] }
const COLOR = /^#[0-9a-f]{6}$/i

function isValid(key, value) {
  if (ALLOWED[key]) return ALLOWED[key].includes(value)
  if (RANGES[key]) return Number.isFinite(value) && value >= RANGES[key][0] && value <= RANGES[key][1]
  if (key === 'fgColor' || key === 'bgColor' || key === 'fgColor2') return COLOR.test(value)
  if (key === 'frameText') return value.length <= 40
  return true
}

// Keeps only known keys with a valid value, so stale storage or a
// hand-edited style link can't break the app.
export function sanitizeSettings(input, keys = Object.keys(DEFAULT_SETTINGS)) {
  const clean = {}
  if (!input || typeof input !== 'object') return clean
  for (const key of keys) {
    if (!(key in input) || !(key in DEFAULT_SETTINGS)) continue
    const fallback = DEFAULT_SETTINGS[key]
    const value = input[key]
    const typeOk = fallback === null ? typeof value === 'string' || value === null : typeof value === typeof fallback
    if (typeOk && isValid(key, value)) clean[key] = value
  }
  return clean
}

function loadSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    const keys = Object.keys(DEFAULT_SETTINGS).filter(key => !NON_PERSISTED_KEYS.includes(key))
    return { ...DEFAULT_SETTINGS, ...sanitizeSettings(stored, keys) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function saveSettings(settings) {
  const toStore = { ...settings }
  for (const key of NON_PERSISTED_KEYS) delete toStore[key]
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore))
  } catch {
    // Quota exceeded (usually a large logo) or storage blocked:
    // keep everything except the logo rather than nothing.
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...toStore, logoUrl: null }))
    } catch {
      // Storage unavailable (private mode etc.) — settings stay in memory only.
    }
  }
}

// `initialOverrides` is applied on top of the saved settings at startup
// (a shared link or style link).
export function useQRSettings(initialOverrides) {
  const [settings, setSettings] = useState(() => ({ ...loadSettings(), ...initialOverrides }))

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  const updateSetting = useCallback((key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }, [])

  const applySettings = useCallback((partial) => {
    setSettings(prev => ({ ...prev, ...sanitizeSettings(partial) }))
  }, [])

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS)
  }, [])

  return { settings, updateSetting, applySettings, resetSettings }
}
