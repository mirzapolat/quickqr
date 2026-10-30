import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import { buildQROptions, createQR } from '../lib/qrRender'

const QRDisplay = forwardRef(function QRDisplay({ data, settings, visible }, ref) {
  const displayRef = useRef(null)
  const containerRef = useRef(null)
  const qrRef = useRef(null)

  // qr-code-styling caches the canvas it renders for raster exports and never
  // invalidates it on update(), so exports from the preview instance go stale.
  // Build a fresh instance from the current settings for every export instead.
  // Each export gets its own instance: raster and SVG exports on one instance
  // race each other, since both replace its internal SVG element.
  const createExporter = () => createQR(data, settings)

  useImperativeHandle(ref, () => ({
    download: (format) => createExporter().download({ name: 'qrcode', extension: format }),
    getBlob: (format = 'png') => createExporter().getRawData(format),
  }))

  useEffect(() => {
    if (!containerRef.current) return
    if (!qrRef.current) {
      qrRef.current = createQR(data, settings)
      qrRef.current.append(containerRef.current)
      return
    }

    qrRef.current.update(buildQROptions(data, settings))
    const el = displayRef.current
    el.classList.add('qr-updating')
    const t = setTimeout(() => el.classList.remove('qr-updating'), 120)
    return () => clearTimeout(t)
  }, [data, settings])

  return (
    <div ref={displayRef} className={`qr-display ${visible ? 'qr-visible' : ''}`}>
      <div className="qr-inner" ref={containerRef} />
    </div>
  )
})

export default QRDisplay
