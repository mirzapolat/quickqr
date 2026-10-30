import { STYLE_KEYS, sanitizeSettings } from '../hooks/useQRSettings'

// A style link carries the look of a code (not its content or logo) in the
// URL hash, so it never reaches the server: /#style=<base64url JSON>

const toBase64Url = (str) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(str)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const fromBase64Url = (str) =>
  new TextDecoder().decode(Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)))

export function createStyleLink(settings) {
  const style = Object.fromEntries(STYLE_KEYS.map(key => [key, settings[key]]))
  return `${window.location.origin}/#style=${toBase64Url(JSON.stringify(style))}`
}

export function readStyleFromHash() {
  const match = window.location.hash.match(/style=([\w-]+)/)
  if (!match) return null
  try {
    const style = sanitizeSettings(JSON.parse(fromBase64Url(match[1])), STYLE_KEYS)
    return Object.keys(style).length ? style : null
  } catch {
    return null
  }
}
