import { useState, useRef, useCallback, useEffect } from 'react'
import './App.css'
import QRDisplay from './components/QRDisplay'
import AdvancedPanel from './components/AdvancedPanel'
import { useQRSettings, buildQRData, DEFAULT_SETTINGS } from './hooks/useQRSettings'

export default function App() {
  const [inputValue, setInputValue] = useState('')
  const [qrData, setQrData] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const [isPasted, setIsPasted] = useState(false)
  const { settings, updateSetting, resetSettings } = useQRSettings()
  const qrRef = useRef(null)
  const toastTimer = useRef(null)

  const triggerQR = useCallback((value) => {
    const data = buildQRData(value, settings)
    setQrData(data)
  }, [settings])

  // Re-generate when settings change if we already have data
  useEffect(() => {
    if (inputValue.trim()) {
      const data = buildQRData(inputValue.trim(), settings)
      setQrData(data)
    }
  }, [settings])

  const showToast = (msg) => {
    clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), 2000)
  }

  const handlePaste = useCallback((e) => {
    const pasted = e.clipboardData?.getData('text') || ''
    if (!pasted) return
    setInputValue(pasted)
    setIsPasted(true)
    const data = buildQRData(pasted, settings)
    setQrData(data)
    setTimeout(() => { setInputValue(''); setIsPasted(false) }, 600)
  }, [settings])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      triggerQR(inputValue.trim())
      setInputValue('')
      setIsPasted(false)
    }
  }

  const handleChange = (e) => {
    setInputValue(e.target.value)
    setIsPasted(false)
  }

  const handleSubmit = () => {
    if (inputValue.trim()) {
      triggerQR(inputValue.trim())
      setInputValue('')
      setIsPasted(false)
    }
  }

  const handleDownload = () => {
    if (qrRef.current) {
      qrRef.current.download(settings.downloadFormat)
      showToast(`Saved as ${settings.downloadFormat.toUpperCase()}`)
    }
  }

  const handleQRClick = async () => {
    if (!qrData) return
    try {
      await navigator.clipboard.writeText(inputValue)
      showToast('Copied to clipboard')
    } catch {
      showToast('Could not copy')
    }
  }

  const qrVisible = !!qrData

  const settingsChanged = JSON.stringify(settings) !== JSON.stringify(DEFAULT_SETTINGS)
  const showReset = qrVisible || settingsChanged

  const handleReset = () => {
    setQrData('')
    setInputValue('')
    setIsPasted(false)
    resetSettings()
  }

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

          <div className="input-row">
            <div className="input-wrap">
              <input
                className="qr-input"
                type="text"
                value={inputValue}
                onChange={handleChange}
                onPaste={handlePaste}
                onKeyDown={handleKeyDown}
                placeholder="Paste a link or type something…"
                autoFocus
                spellCheck={false}
                autoComplete="off"
              />
              <button
                className={`go-btn ${inputValue && !isPasted ? 'go-visible' : ''}`}
                onClick={handleSubmit}
                tabIndex={-1}
                aria-label="Generate QR code"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>

          <div
            className="qr-area"
            onClick={handleQRClick}
            style={{ cursor: qrVisible ? 'pointer' : 'default' }}
            title={qrVisible ? 'Click to copy link' : ''}
          >
            <QRDisplay
              ref={qrRef}
              data={qrData}
              settings={settings}
              visible={qrVisible}
            />
            {qrVisible && (
              <div className="qr-actions">
                <span className="qr-hint">Click to copy</span>
                <span className="qr-actions-sep">·</span>
                <button className="download-btn" onClick={e => { e.stopPropagation(); handleDownload() }}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                    <path d="M8 2v8M4 7l4 4 4-4M2 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Download
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      <AdvancedPanel
        open={advancedOpen}
        settings={settings}
        onUpdate={updateSetting}
        onReset={resetSettings}
      />

      <button
        className={`advanced-toggle ${advancedOpen ? 'toggle-active' : ''}`}
        onClick={() => setAdvancedOpen(v => !v)}
        aria-label="Toggle advanced settings"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="4" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
          <circle cx="12" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
          <circle cx="4" cy="12" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
          <path d="M5.5 4h7M1 8h9M5.5 12h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        {advancedOpen ? 'Simple' : 'Advanced'}
      </button>

      <button
        className={`reset-page-btn ${showReset ? 'reset-page-visible' : ''}`}
        onClick={handleReset}
        aria-label="Reset"
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path d="M2 8a6 6 0 1 0 1.5-3.9M2 4v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Reset
      </button>

      <div className={`toast ${toast ? 'toast-visible' : ''}`}>{toast}</div>
    </div>
  )
}
