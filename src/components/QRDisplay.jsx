import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react'
import QRCodeStyling from 'qr-code-styling'

const QRDisplay = forwardRef(function QRDisplay({ data, settings, visible }, ref) {
  const containerRef = useRef(null)
  const qrRef = useRef(null)
  const [animating, setAnimating] = useState(false)
  const prevDataRef = useRef(null)

  useImperativeHandle(ref, () => ({
    download: (format) => {
      if (qrRef.current) {
        qrRef.current.download({ name: 'qrcode', extension: format || settings.downloadFormat })
      }
    }
  }))

  const dotType = {
    square: 'square',
    rounded: 'rounded',
    dots: 'dots',
  }[settings.dotStyle] || 'square'

  useEffect(() => {
    if (!containerRef.current) return

    const isFirstRender = !qrRef.current

    const qrOptions = {
      width: settings.size,
      height: settings.size,
      type: 'svg',
      data: data || ' ',
      dotsOptions: {
        color: settings.fgColor,
        type: dotType,
      },
      backgroundOptions: {
        color: settings.bgColor,
      },
      cornersSquareOptions: {
        color: settings.fgColor,
        type: settings.dotStyle === 'dots' ? 'dot' : 'square',
      },
      cornersDotOptions: {
        color: settings.fgColor,
        type: settings.dotStyle === 'dots' ? 'dot' : 'square',
      },
      qrOptions: {
        errorCorrectionLevel: settings.errorCorrection,
      },
      margin: settings.margin,
      ...(settings.logoUrl
        ? {
            image: settings.logoUrl,
            imageOptions: {
              hideBackgroundDots: true,
              imageSize: settings.logoSize,
              margin: 4,
            },
          }
        : {}),
    }

    if (isFirstRender) {
      qrRef.current = new QRCodeStyling(qrOptions)
      qrRef.current.append(containerRef.current)
    } else {
      if (prevDataRef.current !== data || true) {
        setAnimating(true)
        setTimeout(() => {
          qrRef.current.update(qrOptions)
          setAnimating(false)
        }, 80)
      }
    }
    prevDataRef.current = data
  }, [data, settings.fgColor, settings.bgColor, settings.size, settings.errorCorrection, settings.dotStyle, settings.margin, settings.logoUrl, settings.logoSize])

  return (
    <div
      className={`qr-display ${visible ? 'qr-visible' : ''} ${animating ? 'qr-updating' : ''}`}
    >
      <div className="qr-inner" ref={containerRef} />
    </div>
  )
})

export default QRDisplay
