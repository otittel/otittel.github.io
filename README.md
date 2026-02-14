Business Card Reader - Static GitHub Pages Site

This repository contains a small static website that lets you upload a photo of a business card, runs client-side OCR using Tesseract.js, extracts contact details, and generates a downloadable vCard (.vcf). The site works on GitHub Pages (no server required) or locally via a simple HTTP server.

Usage
- Open `index.html` locally (best via a local HTTP server) or push this repo to GitHub and enable Pages.
- Upload a card image, review/edit parsed fields, then click "Download vCard".

Local testing
Run a simple Python HTTP server from the repo root and open http://localhost:8000:

```bash
python3 -m http.server 8000
```

Files added
- `index.html` - UI and page markup
- `script.js` - OCR call, parsing heuristics, vCard generation
- `styles.css` - basic styling

Notes
- OCR quality depends on image clarity. For best results, use straight, well-lit scans.
- This uses client-side OCR and parsing heuristics. For higher accuracy you can replace the OCR step with a cloud vision API and a more advanced parser.
