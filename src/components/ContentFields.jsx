import { CRYPTO_COINS, cleanIban, isValidIban } from '../lib/contentTypes'
import { t } from '../lib/i18n'

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
        <section className="sub-fields">
          <Field {...p} name="emailTo" label={t('To (email address)')} type="email" inputMode="email" />
          <Field {...p} name="emailSubject" label={t('Subject')} />
          <Field {...p} name="emailBody" label={t('Message')} multiline />
        </section>
      )

    case 'sms':
      return (
        <section className="sub-fields">
          <Field {...p} name="smsNumber" label={t('Phone number')} type="tel" inputMode="tel" />
          <Field {...p} name="smsMessage" label={t('Message (optional)')} multiline />
        </section>
      )

    case 'whatsapp':
      return (
        <section className="sub-fields">
          <Field {...p} name="waNumber" label={t('Phone number, e.g. +49 151 2345678')} type="tel" inputMode="tel" />
          <Field {...p} name="waMessage" label={t('Message (optional)')} multiline />
          <p className="hint">{t('Include the country code. Leave the number empty to let people pick a chat.')}</p>
        </section>
      )

    case 'wifi':
      return (
        <section className="sub-fields">
          <Field {...p} name="wifiSSID" label={t('Network name (SSID)')} />
          <Field {...p} name="wifiPassword" label={t('Password')} type="password" />
          <div className="segmented">
            {['WPA', 'WEP', 'none'].map(enc => (
              <button
                key={enc}
                className={`seg-btn ${settings.wifiEncryption === enc ? 'seg-active' : ''}`}
                onClick={() => onUpdate('wifiEncryption', enc)}
              >
                {enc === 'none' ? t('Open') : enc}
              </button>
            ))}
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={settings.wifiHidden}
              onChange={e => onUpdate('wifiHidden', e.target.checked)}
            />
            <span>{t('Hidden network')}</span>
          </label>
        </section>
      )

    case 'contact':
      return (
        <section className="sub-fields">
          <Field {...p} name="contactName" label={t('Full name')} autoComplete="name" />
          <Field {...p} name="contactPhone" label={t('Phone')} type="tel" inputMode="tel" />
          <Field {...p} name="contactEmail" label={t('Email')} type="email" inputMode="email" />
          <Field {...p} name="contactOrg" label={t('Company')} />
          <Field {...p} name="contactUrl" label={t('Website')} type="url" inputMode="url" />
        </section>
      )

    case 'event':
      return (
        <section className="sub-fields">
          <Field {...p} name="eventTitle" label={t('Title')} />
          <DateField {...p} name="eventStart" label={t('Starts')} />
          <DateField {...p} name="eventEnd" label={t('Ends')} />
          <Field {...p} name="eventLocation" label={t('Location (optional)')} />
          {!settings.eventEnd && settings.eventStart && <p className="hint">{t('Without an end, the event lasts one hour.')}</p>}
        </section>
      )

    case 'location':
      return (
        <section className="sub-fields">
          <Field {...p} name="locationQuery" label={t('Address, place or 52.52, 13.40')} />
          <p className="hint">{t('Opens the place in Google Maps.')}</p>
        </section>
      )

    case 'sepa': {
      const iban = cleanIban(settings.sepaIban)
      const ibanWrong = iban.length >= 15 && !isValidIban(iban)
      return (
        <section className="sub-fields">
          <Field {...p} name="sepaName" label={t('Recipient name')} maxLength={70} />
          <Field {...p} name="sepaIban" label="IBAN" autoCapitalize="characters" spellCheck={false} aria-invalid={ibanWrong} />
          {ibanWrong && <p className="hint hint-error">{t('This IBAN looks wrong — check for a typo.')}</p>}
          <div className="field-pair">
            <Field {...p} name="sepaAmount" label={t('Amount in € (optional)')} inputMode="decimal" />
            <Field {...p} name="sepaBic" label={t('BIC (optional)')} autoCapitalize="characters" spellCheck={false} />
          </div>
          <Field {...p} name="sepaText" label={t('Reference (optional)')} maxLength={140} />
          <p className="hint">{t('A GiroCode: banking apps across Europe fill in the transfer when they scan it.')}</p>
        </section>
      )
    }

    case 'paypal':
      return (
        <section className="sub-fields">
          <Field {...p} name="paypalUser" label={t('PayPal.Me username or link')} autoCapitalize="off" spellCheck={false} />
          <Field {...p} name="paypalAmount" label={t('Amount (optional), e.g. 12.50 or 12.50 EUR')} inputMode="decimal" />
        </section>
      )

    case 'crypto':
      return (
        <section className="sub-fields">
          <div className="segmented">
            {CRYPTO_COINS.map(coin => (
              <button
                key={coin.value}
                className={`seg-btn ${settings.cryptoCoin === coin.value ? 'seg-active' : ''}`}
                onClick={() => onUpdate('cryptoCoin', coin.value)}
              >
                {coin.label}
              </button>
            ))}
          </div>
          <Field {...p} name="cryptoAddress" label={t('Wallet address')} autoCapitalize="off" spellCheck={false} />
          <Field {...p} name="cryptoAmount" label={t('Amount (optional)')} inputMode="decimal" />
          <p className="hint">{t('Check the address twice: payments to a wrong address can’t be undone.')}</p>
        </section>
      )

    default:
      return null
  }
}
