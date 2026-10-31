import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LOGO_SHAPES, loadImageFromUrl, renderLogo } from '../lib/logo'
import { t } from '../lib/i18n'

const VIEWPORT = 260
const MAX_ZOOM = 6
const SHAPE_LABELS = { square: 'Square', rounded: 'Rounded', circle: 'Circle' }

// Drag to move, pinch / scroll / slider to zoom. Zoom 1 shows the whole
// image, which suits wide wordmarks; zoom in to crop to a mark.
export default function LogoCropDialog({ src, onCancel, onApply }) {
  const [image, setImage] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [shape, setShape] = useState('square')
  const viewportRef = useRef(null)
  const zoomRef = useRef(1)
  const pointers = useRef(new Map())
  const gesture = useRef(null)

  useEffect(() => {
    let alive = true
    loadImageFromUrl(src).then(img => alive && setImage(img)).catch(() => alive && onCancel())
    return () => { alive = false }
  }, [src, onCancel])

  useEffect(() => {
    // Capture phase, so Escape closes only this dialog and not the panel below.
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onCancel()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onCancel])

  const fit = image ? VIEWPORT / Math.max(image.naturalWidth, image.naturalHeight) : 1

  // Keep the image from being dragged out of view.
  const clamp = useCallback((p, z) => {
    if (!image) return p
    const maxX = Math.max(0, (image.naturalWidth * fit * z - VIEWPORT) / 2)
    const maxY = Math.max(0, (image.naturalHeight * fit * z - VIEWPORT) / 2)
    return { x: Math.min(maxX, Math.max(-maxX, p.x)), y: Math.min(maxY, Math.max(-maxY, p.y)) }
  }, [image, fit])

  const zoomTo = useCallback((z) => {
    const next = Math.min(MAX_ZOOM, Math.max(1, z))
    zoomRef.current = next
    setZoom(next)
    setPos(p => clamp(p, next))
  }, [clamp])

  // Scroll to zoom; needs a non-passive listener to keep the page still.
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      zoomTo(zoomRef.current * Math.exp(-e.deltaY * 0.0025))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomTo])

  const startGesture = () => {
    const pts = [...pointers.current.values()]
    if (pts.length === 1) {
      gesture.current = { type: 'pan', from: pts[0], start: pos }
    } else if (pts.length === 2) {
      gesture.current = { type: 'pinch', dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), zoom }
    }
  }

  const handlePointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    startGesture()
  }

  const handlePointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    if (!g) return
    if (g.type === 'pan') {
      setPos(clamp({ x: g.start.x + e.clientX - g.from.x, y: g.start.y + e.clientY - g.from.y }, zoom))
    } else {
      const [a, b] = [...pointers.current.values()]
      zoomTo(g.zoom * Math.hypot(a.x - b.x, a.y - b.y) / g.dist)
    }
  }

  const handlePointerUp = (e) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size) startGesture()
    else gesture.current = null
  }

  const handleKeyDown = (e) => {
    const step = e.shiftKey ? 20 : 5
    const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }
    if (moves[e.key]) {
      e.preventDefault()
      setPos(p => clamp({ x: p.x + moves[e.key][0], y: p.y + moves[e.key][1] }, zoom))
    } else if (e.key === '+' || e.key === '=') {
      zoomTo(zoom * 1.1)
    } else if (e.key === '-') {
      zoomTo(zoom / 1.1)
    } else if (e.key === 'Enter') {
      apply()
    }
  }

  const fitWhole = () => {
    setPos({ x: 0, y: 0 })
    zoomTo(1)
  }

  const apply = () => {
    if (!image) return
    onApply(renderLogo(image, { scale: fit * zoom, x: pos.x, y: pos.y, viewport: VIEWPORT }, shape))
  }

  return createPortal(
    <div className="dialog-overlay" onClick={onCancel}>
      <div
        className="dialog crop-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="crop-title"
        onClick={e => e.stopPropagation()}
      >
        <div className="dialog-header">
          <h2 id="crop-title" className="panel-title">{t('Crop logo')}</h2>
          <button className="icon-btn" onClick={onCancel} aria-label={t('Close')}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div
          ref={viewportRef}
          className={`crop-viewport crop-${shape}`}
          style={{ width: VIEWPORT, height: VIEWPORT }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          aria-label={t('Logo position. Drag or use the arrow keys to move, + and - to zoom.')}
        >
          {image && (
            <img
              src={src}
              alt=""
              draggable={false}
              className="crop-image"
              style={{
                width: image.naturalWidth * fit * zoom,
                height: image.naturalHeight * fit * zoom,
                transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px)`,
              }}
            />
          )}
          <div className="crop-mask" aria-hidden="true" />
        </div>

        <div className="crop-controls">
          <label className="crop-zoom">
            <span className="section-label">{t('Zoom')}</span>
            <input
              type="range"
              className="range-input"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={e => zoomTo(Number(e.target.value))}
            />
          </label>
          <div className="segmented" role="radiogroup" aria-label={t('Shape')}>
            {LOGO_SHAPES.map(s => (
              <button
                key={s}
                role="radio"
                aria-checked={shape === s}
                className={`seg-btn ${shape === s ? 'seg-active' : ''}`}
                onClick={() => setShape(s)}
              >
                {t(SHAPE_LABELS[s])}
              </button>
            ))}
          </div>
        </div>

        <div className="dialog-actions">
          <button className="action-btn" onClick={fitWhole}>{t('Fit')}</button>
          <button className="action-btn action-primary" disabled={!image} onClick={apply}>{t('Use logo')}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
