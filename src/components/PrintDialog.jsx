import { useEffect, useRef, useState } from 'react'
import { PAPERS, CODE_SIZES, layoutSheet, buildPrintPdf, defaultPaper } from '../lib/printSheet'
import { downloadBlob } from '../lib/download'
import { plural, t } from '../lib/i18n'

// items: [{ data, caption }]. With `fill`, the single item repeats to fill
// one sheet (stickers); otherwise each item is printed once.
export default function PrintDialog({ items, fill, settings, onClose, showToast }) {
  const [paper, setPaper] = useState(defaultPaper)
  const [codeSize, setCodeSize] = useState(35)
  const [captions, setCaptions] = useState(!fill)
  const [guides, setGuides] = useState(true)
  const [progress, setProgress] = useState(null)
  const dialogRef = useRef(null)

  const layout = layoutSheet(paper, codeSize, captions)
  const printItems = fill ? Array(layout.perPage).fill(items[0]) : items
  const pageCount = Math.ceil(printItems.length / layout.perPage)
  const firstPageCount = Math.min(printItems.length, layout.perPage)

  useEffect(() => {
    dialogRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleDownload = async () => {
    setProgress(0)
    try {
      const pdf = await buildPrintPdf({
        items: printItems,
        settings,
        paper,
        codeSize,
        captions,
        guides,
        onProgress: setProgress,
      })
      downloadBlob(pdf, 'qr-codes.pdf')
      showToast(t('PDF saved'))
      onClose()
    } catch {
      showToast(t('Could not create the PDF'))
      setProgress(null)
    }
  }

  const pct = (mm, of) => `${(mm / of) * 100}%`
  const busy = progress !== null
  const uniqueCount = fill ? 1 : new Set(items.map(item => item.data)).size

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="print-title"
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
      >
        <div className="dialog-header">
          <h2 id="print-title" className="panel-title">{t('Print sheet')}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t('Close')}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="print-body">
          <div
            className="sheet-preview"
            style={{ aspectRatio: `${layout.paper.width} / ${layout.paper.height}` }}
            aria-hidden="true"
          >
            {Array.from({ length: firstPageCount }, (_, i) => {
              const x = layout.originX + (i % layout.cols) * layout.cellW
              const y = layout.originY + Math.floor(i / layout.cols) * layout.cellH
              return (
                <div
                  key={i}
                  className={`sheet-cell ${guides ? 'sheet-cell-guides' : ''}`}
                  style={{
                    left: pct(x, layout.paper.width),
                    top: pct(y, layout.paper.height),
                    width: pct(layout.cellW, layout.paper.width),
                    height: pct(layout.cellH, layout.paper.height),
                  }}
                >
                  <span
                    className="sheet-code"
                    style={{
                      left: pct(layout.padding, layout.cellW),
                      top: pct(layout.padding, layout.cellH),
                      width: pct(codeSize, layout.cellW),
                      height: pct(codeSize, layout.cellH),
                    }}
                  />
                  {captions && <span className="sheet-caption" style={{ top: pct(layout.padding + codeSize + 1.6, layout.cellH) }} />}
                </div>
              )
            })}
          </div>

          <div className="print-options">
            <div className="print-option">
              <span className="section-label">{t('Paper')}</span>
              <div className="segmented">
                {Object.entries(PAPERS).map(([key, p]) => (
                  <button key={key} className={`seg-btn ${paper === key ? 'seg-active' : ''}`} onClick={() => setPaper(key)}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="print-option">
              <span className="section-label">{t('Code size')}</span>
              <div className="segmented">
                {CODE_SIZES.map(size => (
                  <button key={size} className={`seg-btn ${codeSize === size ? 'seg-active' : ''}`} onClick={() => setCodeSize(size)}>
                    {size} mm
                  </button>
                ))}
              </div>
            </div>

            <label className="checkbox-row">
              <input type="checkbox" checked={captions} onChange={e => setCaptions(e.target.checked)} />
              <span>{t('Caption under each code')}</span>
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={guides} onChange={e => setGuides(e.target.checked)} />
              <span>{t('Dashed cut lines')}</span>
            </label>

            <p className="hint print-summary">
              {t('{count} per sheet', { count: layout.perPage })}
              {!fill && ` · ${plural(pageCount, '{count} page', '{count} pages')}`}
              {' · '}{t('print at 100%')}
            </p>
          </div>
        </div>

        <button className="action-btn action-primary dialog-cta" disabled={busy} onClick={handleDownload}>
          {busy ? t('Rendering {done}/{total}', { done: progress, total: uniqueCount }) : t('Download PDF')}
        </button>
      </div>
    </div>
  )
}
