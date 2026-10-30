import { useRef } from 'react'
import { CONTENT_TYPES } from '../lib/contentTypes'
import ContentFields from './ContentFields'

const DOT_STYLES = [
  { value: 'square', label: 'Square' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'dots', label: 'Dots' },
]

const ERROR_LEVELS = ['L', 'M', 'Q', 'H']

export default function AdvancedPanel({ open, settings, onUpdate, onReset, onClose, onCopyStyleLink }) {
  const logoInputRef = useRef(null)
  const panelRef = useRef(null)
  const dragRef = useRef(null)

  // Swipe the bottom sheet down to dismiss it (mobile).
  const handleTouchStart = (e) => {
    dragRef.current = { startY: e.touches[0].clientY, dy: 0 }
    panelRef.current.style.transition = 'none'
  }

  const handleTouchMove = (e) => {
    if (!dragRef.current) return
    const dy = Math.max(0, e.touches[0].clientY - dragRef.current.startY)
    dragRef.current.dy = dy
    panelRef.current.style.transform = `translateY(${dy}px)`
  }

  const handleTouchEnd = () => {
    if (!dragRef.current) return
    const { dy } = dragRef.current
    dragRef.current = null
    panelRef.current.style.transition = ''
    panelRef.current.style.transform = ''
    if (dy > 80) onClose()
  }

  // Read the logo as a data URL (not a blob: URL) so it survives reloads
  // when settings are persisted.
  const loadLogo = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => onUpdate('logoUrl', reader.result)
    reader.readAsDataURL(file)
  }

  const handleLogoUpload = (e) => {
    loadLogo(e.target.files?.[0])
    e.target.value = ''
  }

  const handleLogoDrop = (e) => {
    e.preventDefault()
    loadLogo(e.dataTransfer.files?.[0])
  }

  return (
    <aside
      ref={panelRef}
      className={`advanced-panel ${open ? 'panel-open' : ''}`}
      aria-label="Customize QR code"
      inert={!open}
    >
      <div
        className="panel-grab"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <div className="panel-drag-handle" />
        <div className="panel-header">
          <span className="panel-title">Customize</span>
          <div className="panel-header-actions">
            <button className="reset-btn" onClick={onReset} title="Reset to defaults">
              Reset
            </button>
            <button className="done-btn" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
      <div className="panel-scroll">

        {/* Content Type */}
        <section className="panel-section">
          <label className="section-label">Content Type</label>
          <div className="chips" role="radiogroup" aria-label="Content type">
            {CONTENT_TYPES.map(ct => (
              <button
                key={ct.value}
                role="radio"
                aria-checked={settings.contentType === ct.value}
                className={`chip ${settings.contentType === ct.value ? 'chip-active' : ''}`}
                onClick={() => onUpdate('contentType', ct.value)}
              >
                {ct.label}
              </button>
            ))}
          </div>
        </section>

        <ContentFields settings={settings} onUpdate={onUpdate} />

        {/* Colors */}
        <section className="panel-section">
          <label className="section-label">Colors</label>
          <div className="color-row">
            <div className="color-item">
              <span className="color-label">Foreground</span>
              <label className="color-picker-wrap">
                <input
                  type="color"
                  value={settings.fgColor}
                  onChange={e => onUpdate('fgColor', e.target.value)}
                  className="color-input"
                />
                <span className="color-hex">{settings.fgColor.toUpperCase()}</span>
              </label>
            </div>
            <div className="color-item">
              <span className="color-label">Background</span>
              <label className="color-picker-wrap">
                <input
                  type="color"
                  value={settings.bgColor}
                  onChange={e => onUpdate('bgColor', e.target.value)}
                  className="color-input"
                />
                <span className="color-hex">{settings.bgColor.toUpperCase()}</span>
              </label>
            </div>
          </div>
        </section>

        {/* Error Correction */}
        <section className="panel-section">
          <label className="section-label">Error Correction</label>
          <div className="segmented">
            {ERROR_LEVELS.map(lvl => (
              <button
                key={lvl}
                className={`seg-btn ${settings.errorCorrection === lvl ? 'seg-active' : ''}`}
                onClick={() => onUpdate('errorCorrection', lvl)}
              >
                {lvl}
              </button>
            ))}
          </div>
          <p className="hint">Higher = more data, more resilient</p>
        </section>

        {/* Dot Style */}
        <section className="panel-section">
          <label className="section-label">Dot Style</label>
          <div className="segmented">
            {DOT_STYLES.map(ds => (
              <button
                key={ds.value}
                className={`seg-btn ${settings.dotStyle === ds.value ? 'seg-active' : ''}`}
                onClick={() => onUpdate('dotStyle', ds.value)}
              >
                {ds.label}
              </button>
            ))}
          </div>
        </section>

        {/* Size */}
        <section className="panel-section">
          <label className="section-label">
            Size <span className="label-value">{settings.size}px</span>
          </label>
          <input
            type="range"
            min={200}
            max={600}
            step={10}
            value={settings.size}
            onChange={e => onUpdate('size', Number(e.target.value))}
            className="range-input"
          />
        </section>

        {/* Margin */}
        <section className="panel-section">
          <label className="section-label">
            Quiet Zone <span className="label-value">{settings.margin}px</span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={settings.margin}
            onChange={e => onUpdate('margin', Number(e.target.value))}
            className="range-input"
          />
        </section>

        {/* Logo */}
        <section className="panel-section">
          <label className="section-label">Logo</label>
          <div
            className="logo-drop"
            onDrop={handleLogoDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => logoInputRef.current?.click()}
          >
            {settings.logoUrl ? (
              <div className="logo-preview-wrap">
                <img src={settings.logoUrl} alt="logo" className="logo-preview" />
                <button
                  className="logo-remove"
                  onClick={e => { e.stopPropagation(); onUpdate('logoUrl', null) }}
                >
                  ×
                </button>
              </div>
            ) : (
              <span className="logo-drop-hint">Choose an image or drop it here</span>
            )}
          </div>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleLogoUpload}
          />
          {settings.logoUrl && (
            <div className="panel-section" style={{ padding: 0, marginTop: 8 }}>
              <label className="section-label">
                Logo Size <span className="label-value">{Math.round(settings.logoSize * 100)}%</span>
              </label>
              <input
                type="range"
                min={0.1}
                max={0.4}
                step={0.01}
                value={settings.logoSize}
                onChange={e => onUpdate('logoSize', Number(e.target.value))}
                className="range-input"
              />
            </div>
          )}
        </section>

        {/* Download Format */}
        <section className="panel-section">
          <label className="section-label">Download Format</label>
          <div className="segmented">
            {['png', 'svg', 'jpeg', 'webp'].map(fmt => (
              <button
                key={fmt}
                className={`seg-btn ${settings.downloadFormat === fmt ? 'seg-active' : ''}`}
                onClick={() => onUpdate('downloadFormat', fmt)}
              >
                {fmt.toUpperCase()}
              </button>
            ))}
          </div>
        </section>

        {/* Style link */}
        <section className="panel-section">
          <label className="section-label">Style Link</label>
          <p className="hint">Share this look with your team. The link carries colours, dots, sizes and format, but not the content or logo.</p>
          <button className="secondary-btn" onClick={onCopyStyleLink}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M6.5 9.5a3 3 0 0 0 4.24 0l2.12-2.12a3 3 0 0 0-4.24-4.24l-.7.7M9.5 6.5a3 3 0 0 0-4.24 0L3.14 8.62a3 3 0 0 0 4.24 4.24l.7-.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Copy style link
          </button>
        </section>
      </div>
    </aside>
  )
}
