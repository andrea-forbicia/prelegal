import { Font } from "@react-pdf/renderer";

/**
 * Noto Serif and Noto Sans (public/fonts, SIL OFL 1.1) cover Latin, Greek and
 * Cyrillic, unlike the PDF built-in fonts which only support WinAnsi, so
 * names like "Łódź" or "Ελλάδα" render correctly. CJK scripts are not covered.
 */
export const SERIF = "Noto Serif";
export const SANS = "Noto Sans";

let registeredBase: string | null = null;

/**
 * Registers the fonts once. `base` is where the files live: a URL such as
 * `${location.origin}/fonts` in the browser, or a directory path in Node.
 */
export function registerPdfFonts(base: string): void {
  if (registeredBase === base) return;
  for (const [family, file] of [
    [SERIF, "NotoSerif"],
    [SANS, "NotoSans"],
  ] as const) {
    Font.register({
      family,
      fonts: [
        { src: `${base}/${file}-Regular.ttf`, fontWeight: "normal" },
        { src: `${base}/${file}-Bold.ttf`, fontWeight: "bold" },
      ],
    });
  }
  registeredBase = base;
}
