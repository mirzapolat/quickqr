import { useCallback, useEffect, useRef, useState } from 'react'
import { decodeFrame, decodeImage } from '../lib/decode'
import { t } from '../lib/i18n'

const IS_TOUCH = window.matchMedia?.('(pointer: coarse)').matches ?? false
const HAS_CAMERA = !!navigator.mediaDevices?.getUserMedia
const SCAN_INTERVAL_MS = 220

// Reads an existing QR code from the camera or an image, so its content can
// be edited and restyled. Phones start the camera right away; computers
// start with an image picker, since few people hold a code up to a webcam.
export default function ScanDialog({ onResult, onClose }) {
  const [camera, setCamera] = useState('off') // off | starting | live | denied
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const fileRef = useRef(null)
  const dialogRef = useRef(null)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
  }, [])

  const startCamera = useCallback(async () => {
    setCamera('starting')
    setStatus('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current
      if (!video) {
        stopCamera()
        return
      }
      video.srcObject = stream
      await video.play()
      setCamera('live')
    } catch {
      stopCamera()
      setCamera('denied')
    }
  }, [stopCamera])

  // Start the camera on phones once the dialog is shown.
  useEffect(() => {
    let cancelled = false
    if (IS_TOUCH && HAS_CAMERA) {
      queueMicrotask(() => {
        if (!cancelled) startCamera()
      })
    }
    return () => {
      cancelled = true
      stopCamera()
    }
  }, [startCamera, stopCamera])

  // Look for a code in the live picture a few times a second.
  useEffect(() => {
    if (camera !== 'live') return
    let stopped = false
    let timer
    const tick = async () => {
      const video = videoRef.current
      if (stopped || !video) return
      if (video.readyState >= 2) {
        const text = await decodeFrame(video, video.videoWidth, video.videoHeight).catch(() => null)
        if (stopped) return
        if (text) {
          stopCamera()
          navigator.vibrate?.(30)
          onResult(text)
          return
        }
      }
      timer = setTimeout(tick, SCAN_INTERVAL_MS)
    }
    tick()
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [camera, onResult, stopCamera])

  useEffect(() => {
    dialogRef.current?.focus()
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const readFile = async (file) => {
    if (!file?.type.startsWith('image/')) {
      setStatus(t('That isn’t an image.'))
      return
    }
    setBusy(true)
    setStatus('')
    try {
      const text = await decodeImage(file)
      if (text) {
        stopCamera()
        onResult(text)
      } else {
        setStatus(t('No QR code found in that image. Try a sharper or closer picture.'))
      }
    } catch {
      setStatus(t('Could not open that image.'))
    } finally {
      setBusy(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    readFile(e.dataTransfer.files?.[0])
  }

  const cameraVisible = camera === 'starting' || camera === 'live'

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="dialog scan-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scan-title"
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
      >
        <div className="dialog-header">
          <h2 id="scan-title" className="panel-title">{t('Scan a code')}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t('Close')}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div
          className={`scan-stage ${cameraVisible ? 'scan-live' : ''}`}
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
        >
          <video ref={videoRef} className="scan-video" playsInline muted aria-hidden={!cameraVisible} />
          {cameraVisible ? (
            <div className="scan-target" aria-hidden="true" />
          ) : (
            <button className="scan-drop" onClick={() => fileRef.current?.click()} disabled={busy}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                <path d="M8 12h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
              <span>{busy ? t('Reading…') : t('Drop, paste or choose an image of a QR code')}</span>
            </button>
          )}
        </div>

        <p className="hint scan-status" role="status">
          {status || (camera === 'live' ? t('Point the camera at a QR code.')
            : camera === 'denied' ? t('Camera not available. You can still choose a photo.')
            : '')}
        </p>

        <div className="dialog-actions">
          {HAS_CAMERA && !cameraVisible && (
            <button className="action-btn" onClick={startCamera}>{t('Use camera')}</button>
          )}
          <button className="action-btn action-primary" onClick={() => fileRef.current?.click()} disabled={busy}>
            {t('Choose image')}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={e => { readFile(e.target.files?.[0]); e.target.value = '' }}
        />
      </div>
    </div>
  )
}
