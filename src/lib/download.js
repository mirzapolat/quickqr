export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Give the browser time to start the download before releasing it.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export const fileExtension = (format) => (format === 'jpeg' ? 'jpg' : format)
