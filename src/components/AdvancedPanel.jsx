import { useCallback, useEffect, useRef, useState } from 'react'
import { CONTENT_TYPES } from '../lib/contentTypes'
import { MIN_LOGO_SIZE, maxLogoSize } from '../lib/qrRender'
import { extractPalette, suggestColours } from '../lib/logo'
import { LANGUAGES, getLanguagePreference, t } from '../lib/i18n'
import { SHORTCUTS } from '../lib/shortcuts'
import LogoCropDialog from './LogoCropDialog'

const DOT_STYLES = [
  { value: 'square', label: 'Square' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'dots', label: 'Dots' },
]

const CORNER_STYLES = [
  { value: 'match', label: 'Match' },
  { value: 'square', label: 'Square' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'circle', label: 'Circle' },
]

const GRADIENTS = [
  { value: 'none', label: 'None' },
  { value: 'linear', label: 'Linear' },
  { value: 'radial', label: 'Radial' },
]

const FRAMES = [
  { value: 'none', label: 'None' },
  { value: 'caption', label: 'Caption' },
  { value: 'badge', label: 'Badge' },
]

const ERROR_LEVELS = ['L', 'M', 'Q', 'H']

const IS_TOUCH = window.matchMedia?.('(pointer: coarse)').matches ?? false

function Segmented({ options, value, onChange, label }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map(o => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          className={`seg-btn ${value === o.value ? 'seg-active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.raw ? o.label : t(o.label)}
        </button>
      ))}
    </div>
  )
}

function ColorField({ label, value, onChange }) {
  return (
    <div className="color-item">
      <span className="color-label">{label}</span>
      <label className="color-picker-wrap">
        <input type="color" value={value} onChange={e => onChange(e.target.value)} className="color-input" />
        <span className="color-hex">{value.toUpperCase()}</span>
      </label>
    </div>
  )
}

function Swatches({ label, colours, onPick }) {
  if (!colours.length) return null
  return (
    <div className="swatch-row">
      <span className="color-label">{label}</span>
      <div className="swatches">
        {colours.map(c => (
          <button
            key={c}
            className="swatch"
            style={{ background: c }}
            onClick={() => onPick(c)}
            title={c.toUpperCase()}
            aria-label={`${label}: ${c.toUpperCase()}`}
          />
        ))}
      </div>
    </div>
  )
}

export default function AdvancedPanel({ open, settings, onUpdate, onApply, onClose, onCopyStyleLink, onLanguageChange }) {
  const logoInputRef = useRef(null)
  const panelRef = useRef(null)
  const scrollRef = useRef(null)
  const onCloseRef = useRef(onClose)
  const [fade, setFade] = useState({ top: false, bottom: false })
  const [cropSrc, setCropSrc] = useState(null)
  const [palette, setPalette] = useState({ url: null, colours: [] })

  // The logo's colours, for one-tap colour suggestions.
  useEffect(() => {
    const url = settings.logoUrl
    if (!url) return
    let alive = true
    extractPalette(url)
      .then(colours => alive && setPalette({ url, colours }))
      .catch(() => alive && setPalette({ url, colours: [] }))
    return () => { alive = false }
  }, [settings.logoUrl])

  const suggestions = palette.url === settings.logoUrl
    ? suggestColours(palette.colours, settings)
    : { code: [], background: [] }

  useEffect(() => {
    onCloseRef.current = onClose
  })

  // Fade the top / bottom edge while there's more to scroll that way.
  const updateFade = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const top = el.scrollTop > 4
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 4
    setFade(f => (f.top === top && f.bottom === bottom ? f : { top, bottom }))
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    // Fires once right away, and again whenever a section grows or shrinks.
    const observer = new ResizeObserver(updateFade)
    observer.observe(el)
    for (const child of el.children) observer.observe(child)
    return () => observer.disconnect()
  }, [updateFade])

  // On phones the panel is a bottom sheet: pull down anywhere on it to close
  // it — once its content is scrolled to the top, so scrolling still works.
  useEffect(() => {
    const panel = panelRef.current
    const scroller = scrollRef.current
    const sheet = window.matchMedia('(max-width: 640px)')
    let drag = null

    const onStart = (e) => {
      if (!sheet.matches || e.touches.length !== 1) return
      if (e.target.closest('input[type="range"], textarea')) return
      const y = e.touches[0].clientY
      drag = { startY: y, lastY: y, lastT: e.timeStamp, active: false, fromHandle: !!e.target.closest('.panel-grab') }
    }

    const onMove = (e) => {
      if (!drag) return
      const y = e.touches[0].clientY
      const dy = y - drag.startY
      if (!drag.active) {
        if (dy > 6 && (drag.fromHandle || scroller.scrollTop <= 0)) {
          drag.active = true
          drag.offset = dy
          panel.style.transition = 'none'
        } else if (Math.abs(dy) > 6) {
          drag = null
          return
        } else {
          return
        }
      }
      e.preventDefault()
      drag.move = Math.max(0, dy - drag.offset)
      drag.velocity = (y - drag.lastY) / Math.max(1, e.timeStamp - drag.lastT)
      drag.lastY = y
      drag.lastT = e.timeStamp
      panel.style.transform = `translateY(${drag.move}px)`
    }

    const onEnd = () => {
      if (!drag) return
      const { active, move = 0, velocity = 0 } = drag
      drag = null
      if (!active) return
      panel.style.transition = ''
      panel.style.transform = ''
      // A long pull or a quick flick closes it.
      if (move > 90 || velocity > 0.5) onCloseRef.current()
    }

    panel.addEventListener('touchstart', onStart, { passive: true })
    panel.addEventListener('touchmove', onMove, { passive: false })
    panel.addEventListener('touchend', onEnd)
    panel.addEventListener('touchcancel', onEnd)
    return () => {
      panel.removeEventListener('touchstart', onStart)
      panel.removeEventListener('touchmove', onMove)
      panel.removeEventListener('touchend', onEnd)
      panel.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  // Read as a data URL (not a blob: URL) so the cropped result survives
  // reloads when settings are persisted.
  const loadLogo = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => setCropSrc(reader.result)
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

  const closeCrop = useCallback(() => setCropSrc(null), [])

  const level = settings.errorCorrection
  const maxLogo = maxLogoSize(level)
  const logoSize = Math.min(settings.logoSize, maxLogo)
  const nextLevel = ERROR_LEVELS[ERROR_LEVELS.indexOf(level) + 1]
  const gradientOn = settings.gradient !== 'none'
  const frameOn = settings.frame !== 'none'

  return (
    <aside
      ref={panelRef}
      className={`advanced-panel ${open ? 'panel-open' : ''}`}
      aria-label={t('Customize QR code')}
      inert={!open}
    >
      <div className="panel-grab">
        <div className="panel-drag-handle" />
        <div className="panel-header">
          <span className="panel-title">{t('Customize')}</span>
          <button className="icon-btn" onClick={onClose} aria-label={t('Close')}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className={`panel-scroll ${fade.top ? 'fade-top' : ''} ${fade.bottom ? 'fade-bottom' : ''}`}
        onScroll={updateFade}
      >

        <section className="panel-section">
          <label className="section-label">{t('Content Type')}</label>
          <div className="chips" role="radiogroup" aria-label={t('Content Type')}>
            {CONTENT_TYPES.map(ct => (
              <button
                key={ct.value}
                role="radio"
                aria-checked={settings.contentType === ct.value}
                className={`chip ${settings.contentType === ct.value ? 'chip-active' : ''}`}
                onClick={() => onUpdate('contentType', ct.value)}
              >
                {t(ct.label)}
              </button>
            ))}
          </div>
        </section>

        <section className="panel-section">
          <label className="section-label">{t('Colors')}</label>
          <div className="color-row">
            <ColorField label={gradientOn ? t('From') : t('Foreground')} value={settings.fgColor} onChange={v => onUpdate('fgColor', v)} />
            {gradientOn && <ColorField label={t('To')} value={settings.fgColor2} onChange={v => onUpdate('fgColor2', v)} />}
            <ColorField label={t('Background')} value={settings.bgColor} onChange={v => onUpdate('bgColor', v)} />
          </div>
          <Segmented options={GRADIENTS} value={settings.gradient} onChange={v => onUpdate('gradient', v)} label={t('Gradient')} />
          {settings.logoUrl && (suggestions.code.length > 0 || suggestions.background.length > 0) && (
            <div className="logo-colours">
              <span className="hint">{t('From your logo')}</span>
              <Swatches label={t('Code')} colours={suggestions.code} onPick={c => onApply({ fgColor: c, gradient: 'none' })} />
              <Swatches label={t('Background')} colours={suggestions.background} onPick={c => onUpdate('bgColor', c)} />
            </div>
          )}
        </section>

        <section className="panel-section">
          <label className="section-label">{t('Dot Style')}</label>
          <Segmented options={DOT_STYLES} value={settings.dotStyle} onChange={v => onUpdate('dotStyle', v)} label={t('Dot Style')} />
        </section>

        <section className="panel-section">
          <label className="section-label">{t('Corners')}</label>
          <Segmented options={CORNER_STYLES} value={settings.cornerStyle} onChange={v => onUpdate('cornerStyle', v)} label={t('Corners')} />
        </section>

        <section className="panel-section">
          <label className="section-label">{t('Frame')}</label>
          <Segmented options={FRAMES} value={settings.frame} onChange={v => onUpdate('frame', v)} label={t('Frame')} />
          {frameOn && (
            <input
              className="sub-input"
              value={settings.frameText}
              maxLength={40}
              placeholder={t('Scan me')}
              aria-label={t('Frame text')}
              onChange={e => onUpdate('frameText', e.target.value)}
            />
          )}
        </section>

        <section className="panel-section">
          <label className="section-label">{t('Error Correction')}</label>
          <Segmented options={ERROR_LEVELS.map(l => ({ value: l, label: l, raw: true }))} value={level} onChange={v => onUpdate('errorCorrection', v)} label={t('Error Correction')} />
          <p className="hint">{t('Higher = more resilient, and room for a bigger logo')}</p>
        </section>

        <section className="panel-section">
          <label className="section-label">
            {t('Size')} <span className="label-value">{settings.size}px</span>
          </label>
          <input
            type="range"
            min={200}
            max={600}
            step={10}
            value={settings.size}
            onChange={e => onUpdate('size', Number(e.target.value))}
            className="range-input"
            aria-label={t('Size')}
          />
        </section>

        <section className="panel-section">
          <label className="section-label">
            {t('Quiet Zone')} <span className="label-value">{settings.margin}px</span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={settings.margin}
            onChange={e => onUpdate('margin', Number(e.target.value))}
            className="range-input"
            aria-label={t('Quiet Zone')}
          />
        </section>

        <section className="panel-section">
          <label className="section-label">{t('Logo')}</label>
          <div
            className="logo-drop"
            onDrop={handleLogoDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => logoInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && logoInputRef.current?.click()}
          >
            {settings.logoUrl ? (
              <div className="logo-preview-wrap">
                <img src={settings.logoUrl} alt={t('Logo')} className="logo-preview" />
                <div className="logo-actions">
                  <button
                    className="link-btn"
                    onClick={e => { e.stopPropagation(); setCropSrc(settings.logoUrl) }}
                  >
                    {t('Crop')}
                  </button>
                  <button
                    className="link-btn"
                    onClick={e => { e.stopPropagation(); onUpdate('logoUrl', null) }}
                  >
                    {t('Remove')}
                  </button>
                </div>
              </div>
            ) : (
              <span className="logo-drop-hint">{t('Choose an image or drop it here')}</span>
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
            <div className="logo-size">
              <label className="section-label">
                {t('Logo Size')} <span className="label-value">{Math.round(logoSize * 100)}%</span>
              </label>
              <input
                type="range"
                min={MIN_LOGO_SIZE}
                max={maxLogo}
                step={0.01}
                value={logoSize}
                onChange={e => onUpdate('logoSize', Number(e.target.value))}
                className="range-input"
                aria-label={t('Logo Size')}
              />
              {nextLevel && (
                <p className="hint hint-action">
                  <span>{t('Up to {max}% scans reliably at {level}.', { max: Math.round(maxLogo * 100), level })}</span>
                  <button className="link-btn" onClick={() => onUpdate('errorCorrection', nextLevel)}>
                    {t('Allow bigger ({level})', { level: nextLevel })}
                  </button>
                </p>
              )}
            </div>
          )}
        </section>

        <section className="panel-section">
          <label className="section-label">{t('Download Format')}</label>
          <Segmented
            options={['png', 'svg', 'jpeg', 'webp'].map(f => ({ value: f, label: f.toUpperCase(), raw: true }))}
            value={settings.downloadFormat}
            onChange={v => onUpdate('downloadFormat', v)}
            label={t('Download Format')}
          />
        </section>

        <section className="panel-section">
          <label className="section-label">{t('Style Link')}</label>
          <p className="hint">{t('Share this look with your team. The link carries colours, dots, frame, sizes and format, but not the content or logo.')}</p>
          <button className="secondary-btn" onClick={onCopyStyleLink}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M6.5 9.5a3 3 0 0 0 4.24 0l2.12-2.12a3 3 0 0 0-4.24-4.24l-.7.7M9.5 6.5a3 3 0 0 0-4.24 0L3.14 8.62a3 3 0 0 0 4.24 4.24l.7-.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {t('Copy style link')}
          </button>
        </section>

        <section className="panel-section">
          <label className="section-label">{t('Language')}</label>
          <Segmented
            options={LANGUAGES.map(l => ({ ...l, raw: l.value !== 'auto' }))}
            value={getLanguagePreference()}
            onChange={onLanguageChange}
            label={t('Language')}
          />
        </section>

        {!IS_TOUCH && (
          <section className="panel-section">
            <label className="section-label">{t('Keyboard Shortcuts')}</label>
            <dl className="shortcuts">
              {SHORTCUTS.map(s => (
                <div key={s.label} className="shortcut">
                  <dt>{t(s.label)}</dt>
                  <dd>{s.keys.map(k => <kbd key={k}>{k}</kbd>)}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>

      {cropSrc && (
        <LogoCropDialog
          src={cropSrc}
          onCancel={closeCrop}
          onApply={url => { onUpdate('logoUrl', url); closeCrop() }}
        />
      )}
    </aside>
  )
}
