import { useEffect, useMemo, useRef, useState } from 'react'
import { contentTypeOf } from '../lib/contentTypes'
import { parseBatch, csvToBatchText, fileNameFor, MAX_BATCH } from '../lib/batch'
import { renderQR } from '../lib/qrRender'
import { createZip } from '../lib/zip'
import { downloadBlob, fileExtension } from '../lib/download'
import { getScanWarnings } from '../lib/scannability'
import ScanWarnings from './ScanWarnings'
import { plural, t } from '../lib/i18n'

const PREVIEW_COUNT = 6

export default function BatchView({ text, onTextChange, settings, onFix, onPrint, showToast }) {
  const [progress, setProgress] = useState(null)
  const [thumbs, setThumbs] = useState([])
  const fileRef = useRef(null)

  const type = contentTypeOf(settings.contentType)
  const items = useMemo(() => parseBatch(text, settings), [text, settings])
  const lineCount = text.split(/\r?\n/).filter(line => line.trim()).length
  const skipped = Math.min(lineCount, MAX_BATCH) - items.length
  const longest = items.reduce((max, item) => (item.data.length > max.length ? item.data : max), '')
  const warnings = useMemo(() => getScanWarnings(settings, longest), [settings, longest])
  const format = settings.downloadFormat

  // Small previews of the first few codes, in the current style
  const previewKey = items.slice(0, PREVIEW_COUNT).map(item => item.data).join('\u0000')
  useEffect(() => {
    const data = previewKey ? previewKey.split('\u0000') : []
    let cancelled = false
    const urls = []
    const t = setTimeout(async () => {
      const next = []
      for (const d of data) {
        const blob = await renderQR(d, { ...settings, size: 200 }, 'svg').catch(() => null)
        if (cancelled) return
        if (blob) {
          const url = URL.createObjectURL(blob)
          urls.push(url)
          next.push(url)
        }
      }
      if (!cancelled) setThumbs(next)
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
      urls.forEach(url => URL.revokeObjectURL(url))
    }
  }, [previewKey, settings])

  const handleCsv = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const imported = csvToBatchText(await file.text())
    if (!imported) {
      showToast(t('No rows found in that file'))
      return
    }
    onTextChange(text.trim() ? `${text.trim()}\n${imported}` : imported)
  }

  const handleZip = async () => {
    setProgress(0)
    try {
      const files = []
      for (const [i, item] of items.entries()) {
        const blob = await renderQR(item.data, settings, format)
        files.push({
          name: fileNameFor(item, i, items.length, fileExtension(format)),
          data: new Uint8Array(await blob.arrayBuffer()),
        })
        setProgress(i + 1)
      }
      downloadBlob(createZip(files), 'qr-codes.zip')
      showToast(plural(items.length, 'Saved {count} code', 'Saved {count} codes'))
    } catch {
      showToast(t('Could not create the ZIP'))
    } finally {
      setProgress(null)
    }
  }

  const busy = progress !== null

  return (
    <div className="batch">
      <textarea
        className="batch-input"
        value={text}
        onChange={e => onTextChange(e.target.value)}
        placeholder={t('{example}, one per line', { example: t(type.placeholder).replace('…', '') })}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        aria-label={t('Batch content, one per line')}
      />
      <div className="batch-meta">
        <span>
          {items.length ? plural(items.length, '{count} code', '{count} codes') : t('One code per line')}
          {skipped > 0 && <span className="batch-skipped"> · {t('{count} skipped', { count: skipped })}</span>}
          {lineCount > MAX_BATCH && <span className="batch-skipped"> · {t('max {count}', { count: MAX_BATCH })}</span>}
        </span>
        <button className="link-btn" onClick={() => fileRef.current?.click()}>{t('Import CSV')}</button>
        <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" hidden onChange={handleCsv} />
      </div>

      {items.length > 0 && (
        <div className="batch-preview" aria-hidden="true">
          {thumbs.map((url, i) => <img key={url} src={url} alt="" title={items[i]?.content} />)}
          {items.length > PREVIEW_COUNT && <span className="batch-more">+{items.length - PREVIEW_COUNT}</span>}
        </div>
      )}

      {items.length > 0 && <ScanWarnings warnings={warnings} onFix={onFix} />}

      <div className="qr-actions">
        <button className="action-btn" disabled={!items.length || busy} onClick={() => onPrint(items.map(item => ({ data: item.data, caption: item.label || item.content })))}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <path d="M4.5 6V2h7v4M4.5 12H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-1.5M4.5 9.5h7V14h-7z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
          </svg>
          {t('Print sheet')}
        </button>
        <button className="action-btn action-primary" disabled={!items.length || busy} onClick={handleZip}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <path d="M8 2v8M4 7l4 4 4-4M2 13.5h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {busy ? t('Rendering {done}/{total}', { done: progress, total: items.length }) : t('Download ZIP')}
          {!busy && <span className="action-format">{format.toUpperCase()}</span>}
        </button>
      </div>
    </div>
  )
}
