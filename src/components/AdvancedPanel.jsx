import { useRef } from 'react'

const CONTENT_TYPES = [
  { value: 'url', label: 'URL' },
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'wifi', label: 'Wi-Fi' },
]

const DOT_STYLES = [
  { value: 'square', label: 'Square' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'dots', label: 'Dots' },
]

const ERROR_LEVELS = ['L', 'M', 'Q', 'H']

export default function AdvancedPanel({ open, settings, onUpdate, onReset }) {
  const logoInputRef = useRef(null)

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    onUpdate('logoUrl', url)
  }

  const handleLogoDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    onUpdate('logoUrl', url)
  }

  return (
    <aside className={`advanced-panel ${open ? 'panel-open' : ''}`}>
      <div className="panel-drag-handle" />
      <div className="panel-scroll">
        <div className="panel-header">
          <span className="panel-title">Advanced</span>
          <button className="reset-btn" onClick={onReset} title="Reset to defaults">
            Reset
          </button>
        </div>

        {/* Content Type */}
        <section className="panel-section">
          <label className="section-label">Content Type</label>
          <div className="segmented">
            {CONTENT_TYPES.map(ct => (
              <button
                key={ct.value}
                className={`seg-btn ${settings.contentType === ct.value ? 'seg-active' : ''}`}
                onClick={() => onUpdate('contentType', ct.value)}
              >
                {ct.label}
              </button>
            ))}
          </div>
        </section>

        {/* WiFi fields */}
        {settings.contentType === 'wifi' && (
          <section className="panel-section sub-fields">
            <input
              className="sub-input"
              placeholder="Network name (SSID)"
              value={settings.wifiSSID}
              onChange={e => onUpdate('wifiSSID', e.target.value)}
            />
            <input
              className="sub-input"
              placeholder="Password"
              type="password"
              value={settings.wifiPassword}
              onChange={e => onUpdate('wifiPassword', e.target.value)}
            />
            <div className="segmented">
              {['WPA', 'WEP', 'none'].map(enc => (
                <button
                  key={enc}
                  className={`seg-btn ${settings.wifiEncryption === enc ? 'seg-active' : ''}`}
                  onClick={() => onUpdate('wifiEncryption', enc)}
                >
                  {enc === 'none' ? 'Open' : enc}
                </button>
              ))}
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={settings.wifiHidden}
                onChange={e => onUpdate('wifiHidden', e.target.checked)}
              />
              <span>Hidden network</span>
            </label>
          </section>
        )}

        {/* Email fields */}
        {settings.contentType === 'email' && (
          <section className="panel-section sub-fields">
            <input
              className="sub-input"
              placeholder="To (email address)"
              value={settings.emailTo}
              onChange={e => onUpdate('emailTo', e.target.value)}
            />
            <input
              className="sub-input"
              placeholder="Subject"
              value={settings.emailSubject}
              onChange={e => onUpdate('emailSubject', e.target.value)}
            />
            <textarea
              className="sub-input sub-textarea"
              placeholder="Body"
              value={settings.emailBody}
              onChange={e => onUpdate('emailBody', e.target.value)}
            />
          </section>
        )}

        {/* Colors */}
        <section className="panel-section">
          <label className="section-label">Colors</label>
          <div className="color-row">
            <div className="color-item">
              <label className="color-label">Foreground</label>
              <div className="color-picker-wrap">
                <input
                  type="color"
                  value={settings.fgColor}
                  onChange={e => onUpdate('fgColor', e.target.value)}
                  className="color-input"
                />
                <span className="color-hex">{settings.fgColor.toUpperCase()}</span>
              </div>
            </div>
            <div className="color-item">
              <label className="color-label">Background</label>
              <div className="color-picker-wrap">
                <input
                  type="color"
                  value={settings.bgColor}
                  onChange={e => onUpdate('bgColor', e.target.value)}
                  className="color-input"
                />
                <span className="color-hex">{settings.bgColor.toUpperCase()}</span>
              </div>
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
              <span className="logo-drop-hint">Drop image or click to upload</span>
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
      </div>
    </aside>
  )
}
