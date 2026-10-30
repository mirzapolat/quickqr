import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import './App.css'
import QRDisplay from './components/QRDisplay'
import AdvancedPanel from './components/AdvancedPanel'
import BatchView from './components/BatchView'
import PrintDialog from './components/PrintDialog'
import ScanWarnings from './components/ScanWarnings'
import { useQRSettings, DEFAULT_SETTINGS } from './hooks/useQRSettings'
import { buildQRData, contentTypeOf, describeQRData } from './lib/contentTypes'
import { getScanWarnings } from './lib/scannability'
import { createStyleLink, readStyleFromHash } from './lib/styleLink'
import { fileExtension } from './lib/download'
import { registerServiceWorker } from './pwa'

const IS_TOUCH = window.matchMedia?.('(pointer: coarse)').matches ?? false
const CAN_SHARE_FILES = (() => {
  try {
    return !!navigator.canShare?.({ files: [new File([''], 'qr.png', { type: 'image/png' })] })
  } catch {
    return false
  }
})()
const CAN_READ_CLIPBOARD = !!navigator.clipboard?.readText

// Text shared into the installed app (Web Share Target) arrives as query
// params. Shared text often wraps a link ("Look at this https://…"), so
// prefer the link when there is one.
function readSharedText() {
  const params = new URLSearchParams(window.location.search)
  const shared = params.get('url') || params.get('text') || params.get('title') || ''
  return shared.match(/https?:\/\/\S+/)?.[0] || shared.trim()
}

// Read once at startup: text shared into the app and a shared style link.
function readStartup() {
  const shared = readSharedText()
  const style = readStyleFromHash()
  const overrides = { ...style }
  // Shared text always shows as a link or plain text, whatever type was last used.
  if (shared) overrides.contentType = /^https?:\/\//i.test(shared) ? 'url' : 'text'
  return { shared, style, overrides }
}

export default function App() {
  const [startup] = useState(readStartup)
  const [inputValue, setInputValue] = useState('')
  // The last submitted input for types without a main field (URL, text,
  // phone). QR data is derived from it so later setting changes re-apply.
  const [sourceText, setSourceText] = useState(startup.shared)
  const [mode, setMode] = useState('single')
  const [batchText, setBatchText] = useState('')
  const [printJob, setPrintJob] = useState(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [toast, setToast] = useState(() => (startup.style ? 'Shared style applied' : null))
  const [isPasted, setIsPasted] = useState(false)
  const { settings, updateSetting, applySettings, resetSettings } = useQRSettings(startup.overrides)
  const qrRef = useRef(null)
  const toastTimer = useRef(null)
  const shareFileRef = useRef(null)

  const contentType = contentTypeOf(settings.contentType)
  const qrData = useMemo(() => buildQRData(sourceText, settings), [sourceText, settings])
  const qrVisible = !!qrData
  const warnings = useMemo(() => getScanWarnings(settings, qrData), [settings, qrData])

  // Drop share-target params and style links so a reload doesn't re-apply them.
  useEffect(() => {
    if (window.location.search || window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname)
    }
    if (startup.style) toastTimer.current = setTimeout(() => setToast(null), 2500)
  }, [startup])

  // A style link opened while the app is already open only changes the hash.
  useEffect(() => {
    const onHashChange = () => {
      const style = readStyleFromHash()
      if (!style) return
      applySettings(style)
      window.history.replaceState(null, '', window.location.pathname)
      clearTimeout(toastTimer.current)
      setToast('Shared style applied')
      toastTimer.current = setTimeout(() => setToast(null), 2500)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [applySettings])

  useEffect(() => {
    registerServiceWorker()
  }, [])

  // Collapse the advanced panel on Escape
  useEffect(() => {
    if (!advancedOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') setAdvancedOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [advancedOpen])

  // Pre-render the image to share. iOS only opens the share sheet while the
  // tap is still "fresh", which rendering on demand can outlast.
  useEffect(() => {
    shareFileRef.current = null
    if (!CAN_SHARE_FILES || !qrVisible) return
    let cancelled = false
    const format = settings.downloadFormat
    const t = setTimeout(async () => {
      try {
        const blob = await qrRef.current?.getBlob(format)
        if (!cancelled && blob) {
          shareFileRef.current = new File([blob], `qrcode.${fileExtension(format)}`, { type: blob.type })
        }
      } catch {
        // Rendered on demand in handleShare instead.
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [qrData, qrVisible, settings])

  const showToast = (msg) => {
    clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), 2200)
  }

  // Types with a main field (SMS number, contact name, …) put the input
  // there, so it shows up and can be edited in the panel.
  const applyInput = (text) => {
    if (contentType.primary) updateSetting(contentType.primary, text)
    else setSourceText(text)
  }

  const submit = (value) => {
    const trimmed = value.trim()
    if (!trimmed) return
    applyInput(trimmed)
    setInputValue('')
    setIsPasted(false)
  }

  const handlePaste = (e) => {
    const pasted = e.clipboardData?.getData('text') || ''
    if (!pasted) return
    e.preventDefault()
    setInputValue(pasted)
    setIsPasted(true)
    applyInput(pasted.trim())
    setTimeout(() => { setInputValue(''); setIsPasted(false) }, 600)
  }

  const handlePasteButton = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim()
      if (text) {
        applyInput(text)
        document.activeElement?.blur()
      } else {
        showToast('Clipboard is empty')
      }
    } catch {
      showToast('Could not read clipboard')
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      submit(inputValue)
      // Close the on-screen keyboard so the QR code is visible.
      if (IS_TOUCH) e.currentTarget.blur()
    }
  }

  const handleChange = (e) => {
    setInputValue(e.target.value)
    setIsPasted(false)
  }

  const handleDownload = async () => {
    if (!qrRef.current) return
    const format = settings.downloadFormat
    try {
      await qrRef.current.download(format)
      showToast(`Saved as ${format.toUpperCase()}`)
    } catch {
      showToast('Could not save image')
    }
  }

  const handleShare = async () => {
    if (!qrRef.current) return
    try {
      let file = shareFileRef.current
      if (!file) {
        const format = settings.downloadFormat
        const blob = await qrRef.current.getBlob(format)
        file = new File([blob], `qrcode.${fileExtension(format)}`, { type: blob.type })
      }
      await navigator.share({ files: [file] })
    } catch (err) {
      if (err?.name !== 'AbortError') showToast('Could not share image')
    }
  }

  const handleCopy = async () => {
    if (!qrData || !qrRef.current) return
    const format = settings.downloadFormat
    // Pass blobs as promises so Safari keeps the user-gesture context.
    const blobFor = (fmt) => qrRef.current.getBlob(fmt).then(b => {
      if (!b) throw new Error('no image')
      return b
    })
    // Browsers only put PNG (and, in Chromium, SVG) images on the clipboard.
    // SVG is copied alongside a PNG so apps that only read bitmaps still work.
    const svgSupported = format === 'svg' && ClipboardItem.supports?.('image/svg+xml')
    const items = { 'image/png': blobFor('png') }
    if (svgSupported) items['image/svg+xml'] = blobFor('svg')
    try {
      await navigator.clipboard.write([new ClipboardItem(items)])
      if (svgSupported || format === 'png') {
        showToast(`Copied as ${format.toUpperCase()}`)
      } else {
        showToast(`Copied as PNG — clipboard can't hold ${format.toUpperCase()}`)
      }
    } catch {
      showToast('Could not copy image')
    }
  }

  const handleCardActivate = () => (CAN_SHARE_FILES && IS_TOUCH ? handleShare() : handleCopy())

  const handleCardKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleCopy()
    }
  }

  const handleCopyStyleLink = async () => {
    const link = createStyleLink(settings)
    try {
      await navigator.clipboard.writeText(link)
      showToast(settings.logoUrl ? 'Style link copied (logo not included)' : 'Style link copied')
    } catch {
      showToast('Could not copy the link')
    }
  }

  const closePrint = useCallback(() => setPrintJob(null), [])

  const settingsChanged = JSON.stringify(settings) !== JSON.stringify(DEFAULT_SETTINGS)
  const showReset = qrVisible || settingsChanged || !!batchText

  const handleReset = () => {
    setSourceText('')
    setInputValue('')
    setIsPasted(false)
    setBatchText('')
    resetSettings()
  }

  const shareFirst = CAN_SHARE_FILES && IS_TOUCH
  const showPasteButton = IS_TOUCH && CAN_READ_CLIPBOARD && !inputValue

  const copyButton = (
    <button className="action-btn" onClick={handleCopy}>
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
        <rect x="5" y="5" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
      Copy
    </button>
  )

  return (
    <div className={`app ${advancedOpen ? 'panel-is-open' : ''}`}>
      {advancedOpen && (
        <div className="panel-overlay" onClick={() => setAdvancedOpen(false)} />
      )}
      <main className="main-area">
        <div className="center-stack">
          <div className="intro-text">
            <h1 className="app-title">Quick QR-Code Generator</h1>
            <p className="app-sub">Paste a link. Get a QR code.</p>
          </div>

          <div className="mode-switch" role="tablist" aria-label="Mode">
            {['single', 'batch'].map(m => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                className={`mode-btn ${mode === m ? 'mode-active' : ''}`}
                onClick={() => setMode(m)}
              >
                {m === 'single' ? 'Single' : 'Batch'}
              </button>
            ))}
          </div>

          {mode === 'batch' ? (
            <BatchView
              text={batchText}
              onTextChange={setBatchText}
              settings={settings}
              onFix={applySettings}
              onPrint={items => setPrintJob({ items, fill: false })}
              showToast={showToast}
            />
          ) : (<>

          <div className="input-wrap">
            <input
              className="qr-input"
              type="text"
              value={inputValue}
              onChange={handleChange}
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
              placeholder={contentType.placeholder}
              autoFocus={!IS_TOUCH}
              inputMode={contentType.inputMode || 'text'}
              enterKeyHint="go"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
              aria-label="QR code content"
            />
            {showPasteButton ? (
              <button className="paste-btn" onClick={handlePasteButton}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <rect x="3" y="2.5" width="10" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M6 2.5h4v2H6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                </svg>
                Paste
              </button>
            ) : (
              <button
                className={`go-btn ${inputValue && !isPasted ? 'go-visible' : ''}`}
                onClick={() => submit(inputValue)}
                tabIndex={-1}
                aria-label="Generate QR code"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
          </div>

          <div className={`qr-area ${qrVisible ? 'qr-area-visible' : ''}`}>
            <div
              className="qr-card"
              role="button"
              tabIndex={qrVisible ? 0 : -1}
              onClick={handleCardActivate}
              onKeyDown={handleCardKeyDown}
              title={qrVisible ? (shareFirst ? 'Tap to share' : 'Click to copy image') : undefined}
              aria-label={shareFirst ? 'Share QR code image' : 'Copy QR code image'}
            >
              <QRDisplay
                ref={qrRef}
                data={qrData}
                settings={settings}
                visible={qrVisible}
              />
            </div>
            {qrVisible && (
              <>
                <p className="qr-data" title={qrData}>{describeQRData(settings, qrData)}</p>
                <ScanWarnings warnings={warnings} onFix={applySettings} />
                <div className="qr-actions">
                  {shareFirst ? (
                    <button className="action-btn action-primary" onClick={handleShare}>
                      <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                        <path d="M8 10V2M5 4.5 8 1.5l3 3M4.5 7H4a1.5 1.5 0 0 0-1.5 1.5v4A1.5 1.5 0 0 0 4 14h8a1.5 1.5 0 0 0 1.5-1.5v-4A1.5 1.5 0 0 0 12 7h-.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Share
                      <span className="action-format">{settings.downloadFormat.toUpperCase()}</span>
                    </button>
                  ) : copyButton}
                  {shareFirst && copyButton}
                  <button
                    className={`action-btn ${shareFirst ? '' : 'action-primary'}`}
                    onClick={handleDownload}
                    aria-label={`Download ${settings.downloadFormat.toUpperCase()}`}
                  >
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                      <path d="M8 2v8M4 7l4 4 4-4M2 13.5h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {shareFirst ? 'Save' : 'Download'}
                    {!shareFirst && <span className="action-format">{settings.downloadFormat.toUpperCase()}</span>}
                  </button>
                </div>
                <button
                  className="link-btn print-link"
                  onClick={() => setPrintJob({ items: [{ data: qrData, caption: describeQRData(settings, qrData) }], fill: true })}
                >
                  Print a sheet of stickers
                </button>
              </>
            )}
          </div>
          </>)}
        </div>
      </main>

      {printJob && (
        <PrintDialog
          items={printJob.items}
          fill={printJob.fill}
          settings={settings}
          onClose={closePrint}
          showToast={showToast}
        />
      )}

      <AdvancedPanel
        open={advancedOpen}
        settings={settings}
        onUpdate={updateSetting}
        onReset={resetSettings}
        onClose={() => setAdvancedOpen(false)}
        onCopyStyleLink={handleCopyStyleLink}
      />

      <div className={`toast ${toast ? 'toast-visible' : ''}`} role="status">{toast}</div>

      <nav className="bottom-bar">
        <button
          className={`bar-btn reset-page-btn ${showReset ? 'reset-page-visible' : ''}`}
          onClick={handleReset}
          aria-label="Reset"
          tabIndex={showReset ? 0 : -1}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M2 8a6 6 0 1 0 1.5-3.9M2 4v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Reset
        </button>

        <a
          className="bar-btn support-link"
          href="https://donate.stripe.com/aFa8wO78f6zndFp2xF0kE03"
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 14s-6-3.9-6-8a4 4 0 0 1 6-3.44A4 4 0 0 1 14 6c0 4.1-6 8-6 8z"/>
          </svg>
          <span>Support<span className="support-long"> this tool</span></span>
        </a>

        <button
          className={`bar-btn advanced-toggle ${advancedOpen ? 'toggle-active' : ''}`}
          onClick={() => setAdvancedOpen(v => !v)}
          aria-label="Toggle advanced settings"
          aria-expanded={advancedOpen}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="4" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <circle cx="12" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <circle cx="4" cy="12" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M5.5 4h7M1 8h9M5.5 12h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          {advancedOpen ? 'Simple' : 'Advanced'}
        </button>
      </nav>
    </div>
  )
}
