// Extra inputs for content types that encode more than one value.

function Field({ settings, onUpdate, name, label, multiline, ...props }) {
  const Tag = multiline ? 'textarea' : 'input'
  return (
    <Tag
      className={`sub-input ${multiline ? 'sub-textarea' : ''}`}
      placeholder={label}
      aria-label={label}
      value={settings[name]}
      onChange={e => onUpdate(name, e.target.value)}
      {...props}
    />
  )
}

function DateField({ settings, onUpdate, name, label }) {
  return (
    <label className="date-row">
      <span>{label}</span>
      <input
        type="datetime-local"
        className="sub-input"
        value={settings[name]}
        onChange={e => onUpdate(name, e.target.value)}
      />
    </label>
  )
}

export default function ContentFields({ settings, onUpdate }) {
  const p = { settings, onUpdate }

  switch (settings.contentType) {
    case 'email':
      return (
        <section className="panel-section sub-fields">
          <Field {...p} name="emailTo" label="To (email address)" type="email" inputMode="email" />
          <Field {...p} name="emailSubject" label="Subject" />
          <Field {...p} name="emailBody" label="Message" multiline />
        </section>
      )

    case 'sms':
      return (
        <section className="panel-section sub-fields">
          <Field {...p} name="smsNumber" label="Phone number" type="tel" inputMode="tel" />
          <Field {...p} name="smsMessage" label="Message (optional)" multiline />
        </section>
      )

    case 'whatsapp':
      return (
        <section className="panel-section sub-fields">
          <Field {...p} name="waNumber" label="Phone number, e.g. +49 151 2345678" type="tel" inputMode="tel" />
          <Field {...p} name="waMessage" label="Message (optional)" multiline />
          <p className="hint">Include the country code. Leave the number empty to let people pick a chat.</p>
        </section>
      )

    case 'wifi':
      return (
        <section className="panel-section sub-fields">
          <Field {...p} name="wifiSSID" label="Network name (SSID)" />
          <Field {...p} name="wifiPassword" label="Password" type="password" />
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
      )

    case 'contact':
      return (
        <section className="panel-section sub-fields">
          <Field {...p} name="contactName" label="Full name" autoComplete="name" />
          <Field {...p} name="contactPhone" label="Phone" type="tel" inputMode="tel" />
          <Field {...p} name="contactEmail" label="Email" type="email" inputMode="email" />
          <Field {...p} name="contactOrg" label="Company" />
          <Field {...p} name="contactUrl" label="Website" type="url" inputMode="url" />
        </section>
      )

    case 'event':
      return (
        <section className="panel-section sub-fields">
          <Field {...p} name="eventTitle" label="Title" />
          <DateField {...p} name="eventStart" label="Starts" />
          <DateField {...p} name="eventEnd" label="Ends" />
          <Field {...p} name="eventLocation" label="Location (optional)" />
          {!settings.eventEnd && settings.eventStart && <p className="hint">Without an end, the event lasts one hour.</p>}
        </section>
      )

    case 'location':
      return (
        <section className="panel-section sub-fields">
          <Field {...p} name="locationQuery" label="Address, place or 52.52, 13.40" />
          <p className="hint">Opens the place in Google Maps.</p>
        </section>
      )

    default:
      return null
  }
}
