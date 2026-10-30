// Minimal PDF writer: lossless RGB images, vector lines and Helvetica text.
// Coordinates are in points from the top-left of the page.
//
// createPdf({ width, height, images, pages })
//   images: [{ width, height, data }]  data = zlib-deflated RGB bytes
//   pages:  [{ images: [{ index, x, y, w, h }],
//              lines:  [{ x1, y1, x2, y2 }],
//              texts:  [{ x, y, size, text, align, gray }] }]

export async function deflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

// Rasterizes an image Blob into deflated RGB for embedding.
export async function imageToPdfImage(blob) {
  const bitmap = await createImageBitmap(blob)
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, bitmap.width, bitmap.height)
  ctx.drawImage(bitmap, 0, 0)
  const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
  const rgb = new Uint8Array(bitmap.width * bitmap.height * 3)
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    rgb[j] = data[i]
    rgb[j + 1] = data[i + 1]
    rgb[j + 2] = data[i + 2]
  }
  return { width: bitmap.width, height: bitmap.height, data: await deflate(rgb) }
}

// Helvetica is a standard PDF font (no embedding) with WinAnsi encoding;
// characters outside Latin-1 become "?".
function pdfString(text) {
  let out = ''
  for (const ch of text) {
    const code = ch.codePointAt(0)
    const c = code >= 32 && code <= 255 ? ch : '?'
    out += c === '(' || c === ')' || c === '\\' ? `\\${c}` : c
  }
  return `(${out})`
}

// Average Helvetica glyph width is ~0.5em; good enough to fit captions.
export function fitText(text, size, maxWidth) {
  const maxChars = Math.floor(maxWidth / (size * 0.52))
  return text.length > maxChars ? `${text.slice(0, Math.max(1, maxChars - 3))}...` : text
}

const num = (n) => Number(n.toFixed(3)).toString()

function latin1(str) {
  const bytes = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i) & 0xff
  return bytes
}

export function createPdf({ width, height, images, pages }) {
  const chunks = []
  const offsets = []
  let length = 0
  const write = (part) => {
    const bytes = typeof part === 'string' ? latin1(part) : part
    chunks.push(bytes)
    length += bytes.length
  }
  const object = (id, body) => {
    offsets[id] = length
    write(`${id} 0 obj\n`)
    for (const part of [].concat(body)) write(part)
    write('\nendobj\n')
  }

  // 1: catalog, 2: page tree, 3: font, then images, then page + content pairs
  const firstImage = 4
  const firstPage = firstImage + images.length
  const pageIds = pages.map((_, i) => firstPage + i * 2)
  const xobjects = images.map((_, i) => `/Im${i} ${firstImage + i} 0 R`).join(' ')

  write('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')
  object(1, '<< /Type /Catalog /Pages 2 0 R >>')
  object(2, `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`)
  object(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')

  images.forEach((img, i) => {
    object(firstImage + i, [
      `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${img.data.length} >>\nstream\n`,
      img.data,
      '\nendstream',
    ])
  })

  pages.forEach((page, i) => {
    const ops = []
    for (const img of page.images || []) {
      ops.push(`q ${num(img.w)} 0 0 ${num(img.h)} ${num(img.x)} ${num(height - img.y - img.h)} cm /Im${img.index} Do Q`)
    }
    if (page.lines?.length) {
      ops.push('q 0.75 G 0.4 w [2 2] 0 d')
      for (const l of page.lines) ops.push(`${num(l.x1)} ${num(height - l.y1)} m ${num(l.x2)} ${num(height - l.y2)} l S`)
      ops.push('Q')
    }
    for (const t of page.texts || []) {
      const w = t.text.length * t.size * 0.52
      const x = t.align === 'center' ? t.x - w / 2 : t.x
      ops.push(`BT ${t.gray ?? 0.35} g /F1 ${num(t.size)} Tf ${num(x)} ${num(height - t.y)} Td ${pdfString(t.text)} Tj ET`)
    }
    const content = ops.join('\n')
    const pageId = pageIds[i]
    object(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(width)} ${num(height)}] /Resources << /Font << /F1 3 0 R >> /XObject << ${xobjects} >> >> /Contents ${pageId + 1} 0 R >>`)
    object(pageId + 1, `<< /Length ${latin1(content).length} >>\nstream\n${content}\nendstream`)
  })

  const total = firstPage + pages.length * 2
  const xref = length
  write(`xref\n0 ${total}\n0000000000 65535 f \n`)
  for (let id = 1; id < total; id++) write(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`)
  write(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)

  return new Blob(chunks, { type: 'application/pdf' })
}
