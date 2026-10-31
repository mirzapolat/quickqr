import { t } from './i18n'

// Practical checks for codes that look fine on screen but fail to scan.
// Each warning can carry a one-tap fix (a settings patch).

function luminance(hex) {
  const channel = (i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

export function getScanWarnings(settings, data = '') {
  const warnings = []
  const bg = luminance(settings.bgColor)
  // With a gradient, the stop closest to the background decides.
  const gradient = settings.gradient && settings.gradient !== 'none'
  const stops = gradient ? [settings.fgColor, settings.fgColor2] : [settings.fgColor]
  const worst = stops.reduce((a, b) => (contrastRatio(a, settings.bgColor) <= contrastRatio(b, settings.bgColor) ? a : b))
  const fg = luminance(worst)
  const ratio = contrastRatio(worst, settings.bgColor)
  const gradientIsTheProblem = gradient && worst === settings.fgColor2 && contrastRatio(settings.fgColor, settings.bgColor) >= 4

  if (ratio < 1.5) {
    warnings.push({
      id: 'contrast',
      message: t('The code and background are almost the same colour.'),
      fix: gradientIsTheProblem
        ? { label: t('Remove gradient'), patch: { gradient: 'none' } }
        : { label: t('Use black on white'), patch: { fgColor: '#000000', bgColor: '#ffffff', gradient: 'none' } },
    })
  } else if (fg > bg) {
    warnings.push({
      id: 'inverted',
      message: t('Light codes on dark backgrounds don’t scan in many apps.'),
      fix: gradient
        ? { label: t('Use black on white'), patch: { fgColor: '#000000', bgColor: '#ffffff', gradient: 'none' } }
        : { label: t('Swap colours'), patch: { fgColor: settings.bgColor, bgColor: settings.fgColor } },
    })
  } else if (ratio < 4) {
    warnings.push({
      id: 'contrast',
      message: t('Low contrast ({ratio}:1). Scanners need a clearly darker code.', { ratio: ratio.toFixed(1) }),
      fix: gradientIsTheProblem
        ? { label: t('Remove gradient'), patch: { gradient: 'none' } }
        : { label: t('Use black'), patch: { fgColor: '#000000', gradient: 'none' } },
    })
  }

  if (settings.margin === 0 && settings.frame !== 'badge') {
    warnings.push({
      id: 'quiet-zone',
      message: t('Without a quiet zone, the code can’t be read on busy backgrounds.'),
      fix: { label: t('Add quiet zone'), patch: { margin: 10 } },
    })
  }

  if (data.length > 300) {
    warnings.push({
      id: 'dense',
      message: t('This much content makes a dense code. Print it at least 4 cm wide.'),
    })
  }

  return warnings
}
