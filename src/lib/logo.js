import { contrastRatio } from './scannability'

// The logo is stored as a small square PNG: enough for print at the sizes a
// logo takes in a code, small enough to keep in local storage.
export const LOGO_PIXELS = 512

export const LOGO_SHAPES = ['square', 'rounded', 'circle']

export function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

// `view` is what the crop dialog shows: the image scaled by `scale` (image
// pixels → viewport pixels), its centre moved by (x, y) from the centre of a
// square viewport of `viewport` pixels.
export function renderLogo(image, { scale, x, y, viewport }, shape) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = LOGO_PIXELS
  const ctx = canvas.getContext('2d')
  const k = LOGO_PIXELS / viewport
  if (shape !== 'square') {
    ctx.beginPath()
    if (shape === 'circle') ctx.arc(LOGO_PIXELS / 2, LOGO_PIXELS / 2, LOGO_PIXELS / 2, 0, Math.PI * 2)
    else ctx.roundRect(0, 0, LOGO_PIXELS, LOGO_PIXELS, LOGO_PIXELS * 0.2)
    ctx.clip()
  }
  const w = image.naturalWidth * scale * k
  const h = image.naturalHeight * scale * k
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, LOGO_PIXELS / 2 + x * k - w / 2, LOGO_PIXELS / 2 + y * k - h / 2, w, h)
  return canvas.toDataURL('image/png')
}

const toHex = (r, g, b) => `#${[r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`

// The logo's main colours, most prominent first. Near-white and near-black
// are left out: they're the defaults already.
export async function extractPalette(url, max = 6) {
  const image = await loadImageFromUrl(url)
  const side = 64
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = side
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(image, 0, 0, side, side)
  const { data } = ctx.getImageData(0, 0, side, side)

  // Bucket by 4 bits per channel, then average each bucket.
  const buckets = new Map()
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 160) continue
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]]
    const key = (r >> 4) << 8 | (g >> 4) << 4 | (b >> 4)
    const bucket = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 }
    bucket.r += r; bucket.g += g; bucket.b += b; bucket.n++
    buckets.set(key, bucket)
  }

  // Anti-aliased edges blend neighbouring colours into small buckets of
  // in-between shades; only colours with a real share of the logo count.
  const opaque = [...buckets.values()].reduce((sum, b) => sum + b.n, 0)
  const colours = [...buckets.values()]
    .filter(({ n }) => n >= opaque * 0.03)
    .map(({ r, g, b, n }) => ({ r: r / n, g: g / n, b: b / n, n }))
    .filter(({ r, g, b }) => Math.min(r, g, b) <= 238 && Math.max(r, g, b) >= 22)
    .sort((a, b) => b.n - a.n)

  // Merge colours that look alike, so the suggestions are distinct.
  const picked = []
  for (const c of colours) {
    if (picked.some(p => Math.hypot(p.r - c.r, p.g - c.g, p.b - c.b) < 48)) continue
    picked.push(c)
    if (picked.length >= max) break
  }
  return picked.map(({ r, g, b }) => toHex(r, g, b))
}

const brightness = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)
}

// Splits a palette into colours that keep the code scannable: for the code
// (clearly darker than the background) and for the background (clearly
// lighter than the code).
export function suggestColours(palette, settings) {
  const MIN = 4.5
  return {
    code: palette.filter(c => c !== settings.fgColor
      && brightness(c) < brightness(settings.bgColor) && contrastRatio(c, settings.bgColor) >= MIN),
    background: palette.filter(c => c !== settings.bgColor
      && brightness(c) > brightness(settings.fgColor) && contrastRatio(settings.fgColor, c) >= MIN),
  }
}
