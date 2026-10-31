// Reads QR codes from images and camera frames. Uses the browser's own
// BarcodeDetector where there is one (Chrome, Android) and falls back to
// jsQR, which is only downloaded the first time it's needed.

let detectorPromise
function getDetector() {
  detectorPromise ??= (async () => {
    if (!('BarcodeDetector' in window)) return null
    try {
      const formats = await window.BarcodeDetector.getSupportedFormats()
      return formats.includes('qr_code') ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null
    } catch {
      return null
    }
  })()
  return detectorPromise
}

let jsQRPromise
const loadJsQR = () => (jsQRPromise ??= import('jsqr').then(m => m.default))

// Large photos are scaled down: decoding gets slower, not better, above this.
const MAX_SIDE = 1600
let scratch

function pixelsOf(source, width, height) {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height))
  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))
  scratch ??= document.createElement('canvas')
  scratch.width = w
  scratch.height = h
  const ctx = scratch.getContext('2d', { willReadFrequently: true })
  // Transparent pixels would read as black; put the image on white.
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(source, 0, 0, w, h)
  return ctx.getImageData(0, 0, w, h)
}

// `source`: an image, bitmap, canvas or playing video. `thorough` also
// tries jsQR when the native detector finds nothing, and inverted codes.
export async function decodeFrame(source, width, height, thorough = false) {
  const detector = await getDetector()
  if (detector) {
    try {
      const [code] = await detector.detect(source)
      if (code?.rawValue) return code.rawValue
    } catch {
      // Some sources (SVG images in Safari) can't be detected natively.
    }
    if (!thorough) return null
  }
  const jsQR = await loadJsQR()
  const { data, width: w, height: h } = pixelsOf(source, width, height)
  return jsQR(data, w, h, { inversionAttempts: thorough ? 'attemptBoth' : 'dontInvert' })?.data ?? null
}

async function loadImage(blob) {
  try {
    return { image: await createImageBitmap(blob), release: (img) => img.close?.() }
  } catch {
    // SVG and some formats can't become a bitmap; an <img> can show them.
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.src = url
    try {
      await img.decode()
    } catch (err) {
      URL.revokeObjectURL(url)
      throw err
    }
    return { image: img, release: () => URL.revokeObjectURL(url) }
  }
}

// Reads the first QR code in an image file. Resolves to its text or null.
export async function decodeImage(blob) {
  const { image, release } = await loadImage(blob)
  try {
    const width = image.naturalWidth || image.width
    const height = image.naturalHeight || image.height
    const text = await decodeFrame(image, width, height, true)
    if (text) return text
    // Tightly cropped codes have no quiet zone; give them one and retry.
    const pad = Math.round(Math.max(width, height) * 0.1)
    const framed = document.createElement('canvas')
    framed.width = width + pad * 2
    framed.height = height + pad * 2
    const ctx = framed.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, framed.width, framed.height)
    ctx.drawImage(image, pad, pad, width, height)
    return await decodeFrame(framed, framed.width, framed.height, true)
  } finally {
    release(image)
  }
}
