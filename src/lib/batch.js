import { buildQRData, contentTypeOf } from './contentTypes'

export const MAX_BATCH = 500

// One item per line. An optional label (file name / caption) follows a tab,
// which is how imported CSVs are shown in the text box.
export function parseBatch(text, settings) {
  const type = contentTypeOf(settings.contentType)
  const items = []
  for (const line of text.split(/\r?\n/)) {
    const [content = '', label = ''] = line.split('\t').map(part => part.trim())
    if (!content) continue
    // For types with a main field (SMS number, contact name, …) each line
    // fills that field; the other fields come from the panel.
    const data = type.primary
      ? buildQRData('', { ...settings, [type.primary]: content })
      : buildQRData(content, settings)
    if (data) items.push({ content, label, data })
    if (items.length >= MAX_BATCH) break
  }
  return items
}

export function parseCsv(text) {
  const firstLine = text.split(/\r?\n/, 1)[0]
  const count = (ch) => firstLine.split(ch).length - 1
  const delimiter = count('\t') > 0 ? '\t' : count(';') > count(',') ? ';' : ','

  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') {
      quoted = true
    } else if (c === delimiter) {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += c
    }
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

const HEADER_WORDS = ['url', 'link', 'links', 'content', 'data', 'text', 'value', 'name', 'number', 'phone', 'email']

// First column is the content, the optional second column its label.
export function csvToBatchText(csv) {
  const rows = parseCsv(csv).filter(row => row.some(cell => cell.trim()))
  if (HEADER_WORDS.includes(rows[0]?.[0]?.trim().toLowerCase())) rows.shift()
  return rows
    .map(row => {
      const content = row[0]?.trim() || ''
      const label = row[1]?.trim()
      return label ? `${content}\t${label}` : content
    })
    .filter(Boolean)
    .join('\n')
}

export function fileNameFor(item, index, total, extension) {
  const slug = (item.label || item.content)
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'qr'
  return `${String(index + 1).padStart(String(total).length, '0')}-${slug}.${extension}`
}
