import QRCodeStyling from 'qr-code-styling'

export function buildQROptions(data, settings) {
  const cornerType = settings.dotStyle === 'dots' ? 'dot' : settings.dotStyle === 'rounded' ? 'extra-rounded' : 'square'
  return {
    width: settings.size,
    height: settings.size,
    type: 'svg',
    data: data || ' ',
    margin: settings.margin,
    dotsOptions: {
      color: settings.fgColor,
      type: settings.dotStyle,
    },
    backgroundOptions: {
      color: settings.bgColor,
    },
    cornersSquareOptions: {
      color: settings.fgColor,
      type: cornerType,
    },
    cornersDotOptions: {
      color: settings.fgColor,
      type: settings.dotStyle === 'square' ? 'square' : 'dot',
    },
    qrOptions: {
      errorCorrectionLevel: settings.errorCorrection,
    },
    // Always set `image` explicitly: qr-code-styling deep-merges updates,
    // so omitting it would keep a previously removed logo around.
    image: settings.logoUrl || undefined,
    imageOptions: {
      hideBackgroundDots: true,
      imageSize: settings.logoSize,
      margin: 4,
    },
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

export function createQR(data, settings) {
  const qr = new QRCodeStyling(buildQROptions(data, settings))
  qr.applyExtension(flattenSvg)
  return qr
}

// Renders one code to a Blob. `size` overrides the pixel size (print
// resolution); the quiet zone scales with it so proportions stay the same.
export function renderQR(data, settings, format = 'png', size = settings.size) {
  const scale = size / settings.size
  return createQR(data, { ...settings, size, margin: Math.round(settings.margin * scale) }).getRawData(format)
}
