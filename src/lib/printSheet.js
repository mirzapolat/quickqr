import { renderQR } from './qrRender'
import { createPdf, imageToPdfImage, fitText } from './pdf'

export const PAPERS = {
  a4: { label: 'A4', width: 210, height: 297 },
  letter: { label: 'Letter', width: 215.9, height: 279.4 },
}
export const CODE_SIZES = [25, 35, 50, 70] // mm

const PAGE_MARGIN = 10 // mm, inside most printers' printable area
const CELL_PADDING = 4 // mm between code and cut line
const CAPTION_HEIGHT = 5 // mm
const FOOTER_HEIGHT = 4 // mm for the "print at 100%" note
const DPI = 300
const PT_PER_MM = 72 / 25.4

export const defaultPaper = () =>
  /^(en-(US|CA)|es-(MX|US)|fr-CA)/.test(navigator.language) ? 'letter' : 'a4'

// Grid of equal cells centered in the printable area. All values in mm.
export function layoutSheet(paperKey, codeSize, captions) {
  const paper = PAPERS[paperKey]
  const cellW = codeSize + CELL_PADDING * 2
  const cellH = codeSize + CELL_PADDING * 2 + (captions ? CAPTION_HEIGHT : 0)
  const usableW = paper.width - PAGE_MARGIN * 2
  const usableH = paper.height - PAGE_MARGIN * 2 - FOOTER_HEIGHT
  const cols = Math.max(1, Math.floor(usableW / cellW))
  const rows = Math.max(1, Math.floor(usableH / cellH))
  return {
    paper,
    cols,
    rows,
    perPage: cols * rows,
    cellW,
    cellH,
    codeSize,
    padding: CELL_PADDING,
    originX: (paper.width - cols * cellW) / 2,
    originY: PAGE_MARGIN + (usableH - rows * cellH) / 2,
  }
}

// items: [{ data, caption }]. Identical codes are embedded once.
export async function buildPrintPdf({ items, settings, paper, codeSize, captions, guides, onProgress }) {
  const layout = layoutSheet(paper, codeSize, captions)
  const pixels = Math.round((codeSize / 25.4) * DPI)
  const pt = (mm) => mm * PT_PER_MM

  const imageIndex = new Map()
  const images = []
  for (const item of items) {
    if (imageIndex.has(item.data)) continue
    const blob = await renderQR(item.data, settings, 'png', pixels)
    imageIndex.set(item.data, images.length)
    images.push(await imageToPdfImage(blob))
    onProgress?.(images.length)
  }

  const pages = []
  for (let start = 0; start < items.length; start += layout.perPage) {
    const pageItems = items.slice(start, start + layout.perPage)
    const page = { images: [], lines: [], texts: [] }

    pageItems.forEach((item, i) => {
      const x = layout.originX + (i % layout.cols) * layout.cellW + CELL_PADDING
      const y = layout.originY + Math.floor(i / layout.cols) * layout.cellH + CELL_PADDING
      page.images.push({ index: imageIndex.get(item.data), x: pt(x), y: pt(y), w: pt(codeSize), h: pt(codeSize) })
      if (captions && item.caption) {
        const size = codeSize < 30 ? 6 : 7
        page.texts.push({
          x: pt(x + codeSize / 2),
          y: pt(y + codeSize + 3.6),
          size,
          align: 'center',
          text: fitText(item.caption, size, pt(codeSize)),
        })
      }
    })

    // Dashed cut lines around every used cell (the last row may be partial)
    if (guides) {
      const { cols, cellW, cellH, originX: left, originY: top } = layout
      const fullRows = Math.floor(pageItems.length / cols)
      const rest = pageItems.length % cols
      const cellsInRow = (r) => (r < fullRows ? cols : r === fullRows ? rest : 0)
      const rowsInCol = (c) => (c < 0 || c >= cols ? 0 : fullRows + (c < rest ? 1 : 0))
      const usedRows = fullRows + (rest ? 1 : 0)
      const usedCols = fullRows ? cols : rest

      for (let r = 0; r <= usedRows; r++) {
        const width = Math.max(cellsInRow(r - 1), cellsInRow(r)) * cellW
        const y = top + r * cellH
        page.lines.push({ x1: pt(left), y1: pt(y), x2: pt(left + width), y2: pt(y) })
      }
      for (let c = 0; c <= usedCols; c++) {
        const height = Math.max(rowsInCol(c - 1), rowsInCol(c)) * cellH
        const x = left + c * cellW
        page.lines.push({ x1: pt(x), y1: pt(top), x2: pt(x), y2: pt(top + height) })
      }
    }

    page.texts.push({
      x: pt(layout.paper.width / 2),
      y: pt(layout.paper.height - PAGE_MARGIN + 2),
      size: 6.5,
      align: 'center',
      gray: 0.6,
      text: `QR codes ${codeSize} mm wide. Print at 100% / actual size.`,
    })
    pages.push(page)
  }

  return createPdf({ width: pt(layout.paper.width), height: pt(layout.paper.height), images, pages })
}
