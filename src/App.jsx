import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import './App.css'
import QRDisplay from './components/QRDisplay'
import AdvancedPanel from './components/AdvancedPanel'
import BatchView from './components/BatchView'
import PrintDialog from './components/PrintDialog'
import ScanWarnings from './components/ScanWarnings'
import ContentFields from './components/ContentFields'
import ScanDialog from './components/ScanDialog'
import RecentList from './components/RecentList'
import { useQRSettings, DEFAULT_SETTINGS } from './hooks/useQRSettings'
import { blankFieldsOf, buildQRData, contentTypeOf, describeQRData } from './lib/contentTypes'
import { parseQRData } from './lib/parseContent'
import { decodeImage } from './lib/decode'
import { addToHistory, clearHistory, loadHistory, removeFromHistory } from './lib/history'
import { getScanWarnings } from './lib/scannability'
import { createStyleLink, readStyleFromHash } from './lib/styleLink'
import { fileExtension } from './lib/download'
import { getLanguagePreference, setLanguagePreference, t } from './lib/i18n'
import { MOD_LABEL, hasMod } from './lib/shortcuts'
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

const imageFileOf = (dataTransfer) =>
  [...(dataTransfer?.files || [])].find(file => file.type.startsWith('image/'))

const isEditable = (el) => !!el?.closest?.('input, textarea, select, [contenteditable="true"]')

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
  const [scanOpen, setScanOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [history, setHistory] = useState(loadHistory)
  const [language, setLanguage] = useState(getLanguagePreference)
  const [toast, setToast] = useState(() => (startup.style ? t('Shared style applied') : null))
  const [isPasted, setIsPasted] = useState(false)
  const { settings, updateSetting, applySettings, resetSettings } = useQRSettings(startup.overrides)
  const qrRef = useRef(null)
  const inputRef = useRef(null)
  const formRef = useRef(null)
  const toastTimer = useRef(null)
  const shareFileRef = useRef(null)
  const actionsRef = useRef({})

  const contentType = contentTypeOf(settings.contentType)
  const qrData = useMemo(() => buildQRData(sourceText, settings), [sourceText, settings])
  const qrVisible = !!qrData
  // The frame caption falls back to "Scan me" in the current language.
  const renderSettings = useMemo(
    () => ({ ...settings, frameText: settings.frameText || t('Scan me') }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t() depends on the language
    [settings, language],
  )
  const warnings = useMemo(
    () => getScanWarnings(settings, qrData),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- messages depend on the language
    [settings, qrData, language],
  )

  // Drop share-target params and style links so a reload doesn't re-apply them.
  useEffect(() => {
    if (window.location.search || window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname)
    }
    if (startup.style) toastTimer.current = setTimeout(() => setToast(null), 2500)
  }, [startup])

  const showToast = useCallback((msg) => {
    clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), 2200)
  }, [])

  // A style link opened while the app is already open only changes the hash.
  useEffect(() => {
    const onHashChange = () => {
      const style = readStyleFromHash()
      if (!style) return
      applySettings(style)
      window.history.replaceState(null, '', window.location.pathname)
      showToast(t('Shared style applied'))
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [applySettings, showToast])

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
    const format = renderSettings.downloadFormat
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
  }, [qrData, qrVisible, renderSettings])

  // Keep a code in "Recent" once it's been used (copied, saved, shared,
  // printed) or submitted from the main input.
  const remember = useCallback((text = sourceText) => {
    const data = buildQRData(text, settings)
    if (!data) return
    const keepText = contentType.primary ? '' : text
    setHistory(prev => addToHistory(prev, { settings, text: keepText, label: describeQRData(settings, data) }))
  }, [settings, sourceText, contentType.primary])

  // Put scanned or pasted code content into the editor.
  const importCode = useCallback((text) => {
    const parsed = parseQRData(text)
    setScanOpen(false)
    setMode('single')
    setInputValue('')
    setIsPasted(false)
    if (parsed.fields) {
      applySettings({ contentType: parsed.contentType, ...blankFieldsOf(parsed.contentType), ...parsed.fields })
      setSourceText('')
    } else {
      applySettings({ contentType: parsed.contentType })
      setSourceText(parsed.text)
    }
    showToast(t('Code read — edit or restyle it'))
  }, [applySettings, showToast])

  const importImage = useCallback(async (file) => {
    showToast(t('Reading…'))
    try {
      const text = await decodeImage(file)
      if (text) importCode(text)
      else showToast(t('No QR code found in that image'))
    } catch {
      showToast(t('Could not open that image.'))
    }
  }, [importCode, showToast])

  // Paste an image of a QR code anywhere to read it.
  useEffect(() => {
    const onPaste = (e) => {
      if (e.defaultPrevented || scanOpen) return
      const file = imageFileOf(e.clipboardData)
      if (!file) return
      e.preventDefault()
      importImage(file)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [importImage, scanOpen])

  // Drop an image of a QR code anywhere to read it. Drops the logo field or
  // a dialog handles itself are left alone.
  useEffect(() => {
    const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files')
    const onDragOver = (e) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setDragging(true)
    }
    const onDragLeave = (e) => {
      if (!e.relatedTarget) setDragging(false)
    }
    const onDrop = (e) => {
      setDragging(false)
      if (e.defaultPrevented || !hasFiles(e)) return
      e.preventDefault()
      const file = imageFileOf(e.dataTransfer)
      if (file) importImage(file)
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [importImage])

  const applyInput = (text) => {
    setSourceText(text)
    remember(text)
  }

  const submit = (value) => {
    const trimmed = value.trim()
    if (!trimmed) return
    applyInput(trimmed)
    setInputValue('')
    setIsPasted(false)
  }

  const handlePaste = (e) => {
    const file = imageFileOf(e.clipboardData)
    if (file) {
      e.preventDefault()
      importImage(file)
      return
    }
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
        showToast(t('Clipboard is empty'))
      }
    } catch {
      showToast(t('Could not read clipboard'))
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
      remember()
      showToast(t('Saved as {format}', { format: format.toUpperCase() }))
    } catch {
      showToast(t('Could not save image'))
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
      remember()
    } catch (err) {
      if (err?.name !== 'AbortError') showToast(t('Could not share image'))
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
      remember()
      if (svgSupported || format === 'png') {
        showToast(t('Copied as {format}', { format: format.toUpperCase() }))
      } else {
        showToast(t('Copied as PNG — clipboard can’t hold {format}', { format: format.toUpperCase() }))
      }
    } catch {
      showToast(t('Could not copy image'))
    }
  }

  const openPrint = () => {
    remember()
    setPrintJob({ items: [{ data: qrData, caption: describeQRData(settings, qrData) }], fill: true })
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
      showToast(settings.logoUrl ? t('Style link copied (logo not included)') : t('Style link copied'))
    } catch {
      showToast(t('Could not copy the link'))
    }
  }

  const handleLanguageChange = (value) => {
    setLanguagePreference(value)
    setLanguage(value)
  }

  const pickRecent = (entry) => {
    applySettings({ contentType: entry.contentType, ...blankFieldsOf(entry.contentType), ...entry.fields })
    setSourceText(entry.text)
    setInputValue('')
    setMode('single')
  }

  const closePrint = useCallback(() => setPrintJob(null), [])
  const closeScan = useCallback(() => setScanOpen(false), [])

  // Keyboard shortcuts. The handlers change every render, so the listener
  // reads the latest ones from a ref.
  useEffect(() => {
    actionsRef.current = { handleCopy, handleDownload, openPrint, canAct: qrVisible && mode === 'single' }
  })

  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented || e.repeat) return
      const editing = isEditable(e.target)
      const actions = actionsRef.current
      if (e.key === '/' && !editing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        const target = inputRef.current || formRef.current?.querySelector('input, textarea')
        target?.focus()
        return
      }
      if (!hasMod(e)) return
      switch (e.key.toLowerCase()) {
        case 'c': {
          // Normal copy wins whenever there's text selected.
          const field = editing && e.target.selectionStart !== e.target.selectionEnd
          if (window.getSelection()?.toString() || field || !actions.canAct) return
          e.preventDefault()
          actions.handleCopy()
          break
        }
        case 's':
          e.preventDefault()
          if (actions.canAct) actions.handleDownload()
          break
        case 'p':
          if (!actions.canAct) return
          e.preventDefault()
          actions.openPrint()
          break
        case 'o':
          e.preventDefault()
          setScanOpen(true)
          break
        case ',':
          e.preventDefault()
          setAdvancedOpen(v => !v)
          break
        default:
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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
  const showRecent = mode === 'single' && !qrVisible && !inputValue

  const copyButton = (
    <button className="action-btn" onClick={handleCopy}>
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
        <rect x="5" y="5" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
      {t('Copy')}
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
          </div>

          <div className="mode-switch">
            <div role="tablist" aria-label={t('Mode')} className="mode-tabs">
              {['single', 'batch'].map(m => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  className={`mode-btn ${mode === m ? 'mode-active' : ''}`}
                  onClick={() => setMode(m)}
                >
                  {m === 'single' ? t('Single') : t('Batch')}
                </button>
              ))}
            </div>
            <span className="mode-divider" aria-hidden="true" />
            <button
              className="mode-btn scan-btn"
              onClick={() => setScanOpen(true)}
              title={IS_TOUCH ? t('Scan a code') : `${t('Scan a code')} (${MOD_LABEL}O)`}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2 5.5V3a1 1 0 0 1 1-1h2.5M10.5 2H13a1 1 0 0 1 1 1v2.5M14 10.5V13a1 1 0 0 1-1 1h-2.5M5.5 14H3a1 1 0 0 1-1-1v-2.5M4.5 8h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              {t('Scan')}
            </button>
          </div>

          {mode === 'batch' ? (
            <BatchView
              text={batchText}
              onTextChange={setBatchText}
              settings={renderSettings}
              onFix={applySettings}
              onPrint={items => setPrintJob({ items, fill: false })}
              showToast={showToast}
            />
          ) : (<>

          {contentType.primary ? (
            <div className="input-wrap" ref={formRef}>
              <ContentFields settings={settings} onUpdate={updateSetting} />
            </div>
          ) : (
          <div className="input-wrap">
            <input
              ref={inputRef}
              className="qr-input"
              type="text"
              value={inputValue}
              onChange={handleChange}
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
              placeholder={t(contentType.placeholder)}
              autoFocus={!IS_TOUCH}
              inputMode={contentType.inputMode || 'text'}
              enterKeyHint="go"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
              aria-label={t('QR code content')}
            />
            {showPasteButton ? (
              <button className="paste-btn" onClick={handlePasteButton}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <rect x="3" y="2.5" width="10" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M6 2.5h4v2H6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                </svg>
                {t('Paste')}
              </button>
            ) : (
              <button
                className={`go-btn ${inputValue && !isPasted ? 'go-visible' : ''}`}
                onClick={() => submit(inputValue)}
                tabIndex={-1}
                aria-label={t('Generate QR code')}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
          </div>
          )}

          {showRecent && (
            <RecentList
              entries={history}
              onPick={pickRecent}
              onRemove={entry => setHistory(prev => removeFromHistory(prev, entry.key))}
              onClear={() => setHistory(clearHistory())}
            />
          )}

          <div className={`qr-area ${qrVisible ? 'qr-area-visible' : ''}`}>
            <div
              className="qr-card"
              role="button"
              tabIndex={qrVisible ? 0 : -1}
              onClick={handleCardActivate}
              onKeyDown={handleCardKeyDown}
              title={qrVisible ? (shareFirst ? t('Tap to share') : t('Click to copy image')) : undefined}
              aria-label={shareFirst ? t('Share QR code image') : t('Copy QR code image')}
            >
              <QRDisplay
                ref={qrRef}
                data={qrData}
                settings={renderSettings}
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
                      {t('Share')}
                      <span className="action-format">{settings.downloadFormat.toUpperCase()}</span>
                    </button>
                  ) : copyButton}
                  {/* The share sheet already offers "Save Image", so phones
                      that can share files don't need a separate Save. */}
                  {shareFirst ? copyButton : (
                    <button
                      className="action-btn action-primary"
                      onClick={handleDownload}
                      aria-label={t('Download {format}', { format: settings.downloadFormat.toUpperCase() })}
                    >
                      <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                        <path d="M8 2v8M4 7l4 4 4-4M2 13.5h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {t('Download')}
                      <span className="action-format">{settings.downloadFormat.toUpperCase()}</span>
                    </button>
                  )}
                </div>
                <button className="link-btn print-link" onClick={openPrint}>
                  {t('Print a sheet of stickers')}
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
          settings={renderSettings}
          onClose={closePrint}
          showToast={showToast}
        />
      )}

      {scanOpen && <ScanDialog onResult={importCode} onClose={closeScan} />}

      {dragging && !advancedOpen && !scanOpen && (
        <div className="drop-overlay" aria-hidden="true">
          <span>{t('Drop an image to read its QR code')}</span>
        </div>
      )}

      <AdvancedPanel
        open={advancedOpen}
        settings={settings}
        onUpdate={updateSetting}
        onApply={applySettings}
        onClose={() => setAdvancedOpen(false)}
        onCopyStyleLink={handleCopyStyleLink}
        onLanguageChange={handleLanguageChange}
      />

      <div className={`toast ${toast ? 'toast-visible' : ''}`} role="status">{toast}</div>

      <nav className="bottom-bar">
        <button
          className={`bar-btn reset-page-btn ${showReset ? 'reset-page-visible' : ''}`}
          onClick={handleReset}
          aria-label={t('Reset')}
          tabIndex={showReset ? 0 : -1}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M2 8a6 6 0 1 0 1.5-3.9M2 4v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="bar-label">{t('Reset')}</span>
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
          <span className="support-long">{t('Support this tool')}</span>
          <span className="support-short">{t('Support')}</span>
        </a>

        <button
          className={`bar-btn advanced-toggle ${advancedOpen ? 'toggle-active' : ''}`}
          onClick={() => setAdvancedOpen(v => !v)}
          aria-label={t('Toggle advanced settings')}
          aria-expanded={advancedOpen}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="4" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <circle cx="12" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <circle cx="4" cy="12" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M5.5 4h7M1 8h9M5.5 12h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          {advancedOpen ? t('Simple') : t('Advanced')}
        </button>
      </nav>
    </div>
  )
}
