import QRCodeStyling from 'qr-code-styling'
import { t } from './i18n'

// Share of the code each error correction level can restore.
const EC_CAPACITY = { L: 0.07, M: 0.15, Q: 0.25, H: 0.3 }
// A logo may cover at most this part of that capacity, which leaves the
// rest for smudges, glare and print defects.
const LOGO_SAFETY = 0.7

// The widest logo (share of the code width) that still scans reliably.
export const maxLogoSize = (level) => Math.floor(Math.sqrt(EC_CAPACITY[level] * LOGO_SAFETY) * 100) / 100
export const MIN_LOGO_SIZE = 0.1
export const logoSizeFor = (settings) => Math.min(settings.logoSize, maxLogoSize(settings.errorCorrection))

// Corner (finder pattern) shapes: [outer square, inner dot]
const CORNERS = {
  square: ['square', 'square'],
  rounded: ['extra-rounded', 'dot'],
  circle: ['dot', 'dot'],
}

function cornerTypes(settings) {
  if (settings.cornerStyle !== 'match') return CORNERS[settings.cornerStyle] || CORNERS.square
  if (settings.dotStyle === 'dots') return CORNERS.circle
  if (settings.dotStyle === 'rounded') return CORNERS.rounded
  return CORNERS.square
}

// Extra height below the code for a frame caption.
const frameExtra = (size) => Math.round(size * 0.17)
export const hasFrame = (settings) => settings.frame && settings.frame !== 'none'

export function buildQROptions(data, settings) {
  const [cornerSquare, cornerDot] = cornerTypes(settings)
  const gradient = settings.gradient && settings.gradient !== 'none'
    ? {
        type: settings.gradient,
        rotation: Math.PI / 4,
        colorStops: [{ offset: 0, color: settings.fgColor }, { offset: 1, color: settings.fgColor2 }],
      }
    : undefined
  const fill = { color: settings.fgColor, gradient }
  const framed = hasFrame(settings)
  const size = settings.size
  // A badge border needs its own quiet zone inside it.
  const margin = settings.frame === 'badge' ? Math.max(settings.margin, Math.round(size * 0.09)) : settings.margin
  const logoWidth = logoSizeFor(settings)

  return {
    width: size,
    height: framed ? size + frameExtra(size) : size,
    type: 'svg',
    data: data || ' ',
    margin,
    dotsOptions: { ...fill, type: settings.dotStyle },
    backgroundOptions: {
      color: settings.bgColor,
    },
    cornersSquareOptions: { ...fill, type: cornerSquare },
    cornersDotOptions: { ...fill, type: cornerDot },
    qrOptions: {
      errorCorrectionLevel: settings.errorCorrection,
    },
    // Always set `image` explicitly: qr-code-styling deep-merges updates,
    // so omitting it would keep a previously removed logo around.
    image: settings.logoUrl || undefined,
    imageOptions: {
      hideBackgroundDots: true,
      // qr-code-styling reads imageSize as a share of what the error
      // correction can restore; convert from the logo's width.
      imageSize: (logoWidth * logoWidth) / EC_CAPACITY[settings.errorCorrection],
      margin: Math.round(size * 0.012),
    },
    // Read by the frame extension (qr-code-styling keeps unknown options).
    frameOptions: framed
      ? {
          style: settings.frame,
          text: (settings.frameText || t('Scan me')).trim(),
          color: settings.fgColor,
          background: settings.bgColor,
          extra: frameExtra(size),
        }
      : null,
  }
}

const SVG_NS = 'http://www.w3.org/2000/svg'

// qr-code-styling paints every shape as a clip-path over a filled rect.
// Browsers cope, but many editors and viewers (Illustrator, Office, image
// previewers) render that blank or as one solid block. Replace each clipped
// rect with the actual shapes, filled directly.
function flattenSvg(svg, options) {
  svg.querySelectorAll('[clip-path]').forEach(el => {
    const id = el.getAttribute('clip-path').match(/#([^'")]+)/)?.[1]
    const clip = id && svg.querySelector(`[id="${id}"]`)
    if (!clip) return
    const group = svg.ownerDocument.createElementNS(SVG_NS, 'g')
    group.setAttribute('fill', el.getAttribute('fill'))
    // Rounded modules are drawn as touching shapes; a hairline stroke in the
    // same colour closes the anti-aliasing seams between them.
    if (options.dotsOptions.type === 'rounded' && id.startsWith('clip-path-dot-color')) {
      group.setAttribute('stroke', el.getAttribute('fill'))
      group.setAttribute('stroke-width', '0.35')
    }
    for (const child of [...clip.children]) {
      const shape = child.cloneNode(true)
      const rule = shape.getAttribute('clip-rule')
      if (rule) {
        shape.setAttribute('fill-rule', rule)
        shape.removeAttribute('clip-rule')
      }
      group.appendChild(shape)
    }
    el.replaceWith(group)
    clip.remove()
  })
  svg.querySelectorAll('defs').forEach(defs => {
    if (!defs.children.length) defs.remove()
  })
  // Square modules are separate rects; anti-aliasing leaves hairline seams
  // between neighbours unless edges are rendered crisp.
  if (options.dotsOptions.type === 'square') svg.setAttribute('shape-rendering', 'crispEdges')
}

const FRAME_FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif"

// Adds a caption under the code ("caption") or a border with a filled label
// band ("badge"). It runs inside qr-code-styling, so every export (SVG,
// raster, print, batch) gets the same frame.
function addFrame(svg, options) {
  const frame = options.frameOptions
  if (!frame) return
  const doc = svg.ownerDocument
  const w = options.width
  const h = options.height
  const size = h - frame.extra

  // The code is centred in the taller canvas; move it to the top so the
  // caption gets the space below.
  const shift = doc.createElementNS(SVG_NS, 'g')
  shift.setAttribute('transform', `translate(0 ${-frame.extra / 2})`)
  for (const el of [...svg.children]) {
    const clip = el.getAttribute('clip-path') || ''
    if (el.tagName === 'defs' || clip.includes('clip-path-background-color')) continue
    shift.appendChild(el)
  }
  svg.appendChild(shift)

  const fontSize = Math.round(frame.extra * 0.4)
  const text = doc.createElementNS(SVG_NS, 'text')
  text.textContent = frame.text.toUpperCase()
  text.setAttribute('x', String(w / 2))
  text.setAttribute('text-anchor', 'middle')
  text.setAttribute('dominant-baseline', 'central')
  text.setAttribute('font-family', FRAME_FONT)
  text.setAttribute('font-weight', '700')
  text.setAttribute('font-size', String(fontSize))
  text.setAttribute('letter-spacing', String(fontSize * 0.08))

  if (frame.style === 'badge') {
    const stroke = Math.max(2, Math.round(w * 0.022))
    const r = Math.round(w * 0.06)
    const inset = stroke / 2
    const border = doc.createElementNS(SVG_NS, 'rect')
    border.setAttribute('x', String(inset))
    border.setAttribute('y', String(inset))
    border.setAttribute('width', String(w - stroke))
    border.setAttribute('height', String(h - stroke))
    border.setAttribute('rx', String(r))
    border.setAttribute('fill', 'none')
    border.setAttribute('stroke', frame.color)
    border.setAttribute('stroke-width', String(stroke))
    const band = doc.createElementNS(SVG_NS, 'path')
    const top = size - inset
    band.setAttribute('d', [
      `M${inset} ${top}`, `H${w - inset}`, `V${h - inset - r}`,
      `A${r} ${r} 0 0 1 ${w - inset - r} ${h - inset}`, `H${inset + r}`,
      `A${r} ${r} 0 0 1 ${inset} ${h - inset - r}`, 'Z',
    ].join(' '))
    band.setAttribute('fill', frame.color)
    svg.append(band, border)
    text.setAttribute('y', String(top + (h - top) / 2))
    text.setAttribute('fill', frame.background)
  } else {
    // Sit in the lower part of the quiet zone, close to the code.
    text.setAttribute('y', String(size - options.margin * 0.35 + frame.extra / 2))
    text.setAttribute('fill', frame.color)
  }
  svg.appendChild(text)
}

export function createQR(data, settings) {
  const qr = new QRCodeStyling(buildQROptions(data, settings))
  qr.applyExtension((svg, options) => {
    addFrame(svg, options)
    flattenSvg(svg, options)
  })
  return qr
}

// Renders one code to a Blob. `size` overrides the pixel size (print
// resolution); the quiet zone scales with it so proportions stay the same.
export function renderQR(data, settings, format = 'png', size = settings.size) {
  const scale = size / settings.size
  return createQR(data, { ...settings, size, margin: Math.round(settings.margin * scale) }).getRawData(format)
}
