# Quick QR-Code Generator

Paste a link, get a QR code instantly. Everything else is one tap away.

## Usage

Paste a URL → QR appears immediately. Type manually → press Enter or the arrow button.

Click the QR code to copy the image (on phones: tap to share). Download, print a sheet of stickers, or switch to **Batch** for many codes at once (ZIP or PDF).

**Scan** reads an existing code from the camera, an image file, or an image pasted or dropped anywhere on the page, and opens it for editing and restyling.

**Recent** codes show under the empty input. They stay on this device; Wi-Fi passwords are never stored.

**Advanced** (bottom-right) has:

- Content types: URL, text, email, phone, SMS, WhatsApp, Wi-Fi, contact (vCard), event (iCal), location, bank transfer (EPC GiroCode, with IBAN check), PayPal, crypto
- Colours with linear / radial gradients, and colour suggestions taken from your logo
- Dot and corner styles, a "Scan me" caption or badge frame
- Logo with cropping (square, rounded, circle). The size slider only offers sizes that still scan at the chosen error correction.
- Size, quiet zone, export format (PNG, SVG, JPEG, WebP), style links to share a look
- Language (English, German; detected automatically)

Scan warnings flag low contrast, inverted colours, missing quiet zones and dense codes, each with a one-tap fix.

### Keyboard shortcuts

| Keys | Action |
| --- | --- |
| ⌘/Ctrl C | Copy the code (normal copy when text is selected) |
| ⌘/Ctrl S | Download |
| ⌘/Ctrl P | Print stickers |
| ⌘/Ctrl O | Scan or open an image |
| ⌘/Ctrl , | Customize |
| / | Focus the input |
| Esc | Close |

## Dev

```bash
npm install
npm run dev
npm test
npm run build
```

Translations live in `src/locales/`, keyed by the English text.

## Stack

- Vite + React
- [qr-code-styling](https://github.com/kozakdenys/qr-code-styling)
- [jsQR](https://github.com/cozmo/jsQR) (scanning fallback where the browser has no BarcodeDetector; loaded on demand)
- Vitest
