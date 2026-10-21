# Prelegal frontend

Next.js prototype of the Mutual NDA Creator (PL-3). The user fills in the key
terms of a Common Paper Mutual Non-Disclosure Agreement, sees the completed
agreement in a live preview, and downloads it as a PDF.

## Development

```bash
npm install
npm run dev     # http://localhost:3000, proxies /api to the backend on :8000
npm test        # unit tests (Vitest)
npm run lint
npm run build   # static export to out/, served by the FastAPI backend
```

In production the static export is served by the backend from a single Docker
container; see the [root README](../README.md) for how to run the full app.
Set `BACKEND_URL` to proxy `npm run dev` to a backend on another address.

## How it works

- The Standard Terms are read at build time from the repository-level
  `templates/Mutual-NDA.md` (see `catalog.json`) and parsed into a structured
  model in `src/lib/standard-terms.ts`.
- `src/lib/cover-page.ts` turns the form data into the Cover Page, following
  `templates/Mutual-NDA-coverpage.md`. Empty fields are shown as highlighted
  placeholders.
- The same model feeds both the HTML preview (`NdaPreview`) and the PDF
  (`NdaPdf`, rendered in the browser with `@react-pdf/renderer`).
- The PDF embeds Noto Serif and Noto Sans (`public/fonts`, SIL OFL 1.1) so
  Latin, Greek and Cyrillic names render correctly; CJK is not covered.

Values entered by the user appear on the Cover Page; the Standard Terms refer
to them as defined terms (e.g. "Purpose", "Governing Law"), as in the Common
Paper template.

The templates are licensed under [CC BY 4.0](../templates/LICENSE.txt).
