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
  const fg = luminance(settings.fgColor)
  const bg = luminance(settings.bgColor)
  const ratio = contrastRatio(settings.fgColor, settings.bgColor)

  if (ratio < 1.5) {
    warnings.push({
      id: 'contrast',
      message: 'The code and background are almost the same colour.',
      fix: { label: 'Use black on white', patch: { fgColor: '#000000', bgColor: '#ffffff' } },
    })
  } else if (fg > bg) {
    warnings.push({
      id: 'inverted',
      message: 'Light codes on dark backgrounds don’t scan in many apps.',
      fix: { label: 'Swap colours', patch: { fgColor: settings.bgColor, bgColor: settings.fgColor } },
    })
  } else if (ratio < 4) {
    warnings.push({
      id: 'contrast',
      message: `Low contrast (${ratio.toFixed(1)}:1). Scanners need a clearly darker code.`,
      fix: { label: 'Use black', patch: { fgColor: '#000000' } },
    })
  }

  // qr-code-styling shrinks the logo to what the error correction can
  // absorb, so with L/M it ends up small and leaves no room for smudges.
  if (settings.logoUrl && (settings.errorCorrection === 'L' || settings.errorCorrection === 'M')) {
    warnings.push({
      id: 'logo',
      message: `A logo needs stronger error correction than ${settings.errorCorrection} to scan reliably.`,
      fix: { label: 'Use H', patch: { errorCorrection: 'H' } },
    })
  }

  if (settings.margin === 0) {
    warnings.push({
      id: 'quiet-zone',
      message: 'Without a quiet zone, the code can’t be read on busy backgrounds.',
      fix: { label: 'Add quiet zone', patch: { margin: 10 } },
    })
  }

  if (data.length > 300) {
    warnings.push({
      id: 'dense',
      message: 'This much content makes a dense code. Print it at least 4 cm wide.',
    })
  }

  return warnings
}
