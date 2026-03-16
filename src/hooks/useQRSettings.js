import { useState, useCallback } from 'react'

export const DEFAULT_SETTINGS = {
  contentType: 'url',
  dotStyle: 'square',
  fgColor: '#000000',
  bgColor: '#ffffff',
  errorCorrection: 'M',
  size: 300,
  margin: 10,
  logoUrl: null,
  logoSize: 0.25,
  downloadFormat: 'png',
  // WiFi
  wifiSSID: '',
  wifiPassword: '',
  wifiEncryption: 'WPA',
  wifiHidden: false,
  // Email
  emailTo: '',
  emailSubject: '',
  emailBody: '',
}

export function useQRSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)

  const updateSetting = useCallback((key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }, [])

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS)
  }, [])

  return { settings, updateSetting, resetSettings }
}

export function buildQRData(text, settings) {
  if (!text) return ''
  switch (settings.contentType) {
    case 'url':
      return text.startsWith('http://') || text.startsWith('https://') || text.startsWith('mailto:') || text.startsWith('tel:')
        ? text
        : `https://${text}`
    case 'text':
      return text
    case 'email':
      const parts = []
      if (settings.emailTo) parts.push(`mailto:${settings.emailTo}`)
      const params = []
      if (settings.emailSubject) params.push(`subject=${encodeURIComponent(settings.emailSubject)}`)
      if (settings.emailBody) params.push(`body=${encodeURIComponent(settings.emailBody)}`)
      if (params.length) return `${parts[0] || 'mailto:'}?${params.join('&')}`
      return parts[0] || `mailto:${text}`
    case 'phone':
      return `tel:${text.replace(/\s/g, '')}`
    case 'wifi':
      const enc = settings.wifiEncryption === 'none' ? 'nopass' : settings.wifiEncryption
      const hidden = settings.wifiHidden ? 'H:true;' : ''
      return `WIFI:T:${enc};S:${settings.wifiSSID};P:${settings.wifiPassword};${hidden};`
    default:
      return text
  }
}
