/**
 * Builds public/manual/Enhakkore-Admin-Manual.pdf from docs/ADMIN-MANUAL.md.
 * Run from apps/web:  npx tsx scripts/manual-pdf.ts
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { renderManual } from '../src/lib/manual';
// (renderManual is pure; the markdown is read from the repository directly here.)

const root = path.resolve(__dirname, '..');
const markdown = readFileSync(path.resolve(root, '../../docs/ADMIN-MANUAL.md'), 'utf8');
// Embed screenshots so the PDF needs no network or file access.
// Screenshots are re-encoded as small JPEGs to keep the PDF light.
async function embed(html: string): Promise<string> {
  const sources = [...new Set([...html.matchAll(/src="(\/manual\/[^"]+\.webp)"/g)].map((match) => match[1]!))];
  for (const src of sources) {
    const jpeg = await sharp(path.join(root, 'public', src)).resize({ width: 520, withoutEnlargement: true }).jpeg({ quality: 72 }).toBuffer();
    html = html.split(`src="${src}"`).join(`src="data:image/jpeg;base64,${jpeg.toString('base64')}"`);
  }
  return html;
}
const css = readFileSync(path.join(root, 'src/app/globals.css'), 'utf8').split('/* Admin User Manual (/admin/help) */')[1] ?? '';

const build = (html: string) => `<!doctype html><html><head><meta charset="utf-8"><style>
body { font-family: Arial, Helvetica, sans-serif; margin: 0; }
${css}
.manual figure { max-width: 9.5rem; break-inside: avoid; display: inline-block; margin: 0.5rem 1rem 0.5rem 0; vertical-align: top; }
.manual h2 { break-after: avoid; }
</style></head><body><article class="manual">${html}</article></body></html>`;

(async () => {
  const browser = await chromium.launch();
  const tab = await browser.newPage();
  await tab.setContent(build(await embed(renderManual(markdown).html)), { waitUntil: 'load' });
  await tab.pdf({
    path: path.join(root, 'public/manual/Enhakkore-Admin-Manual.pdf'),
    format: 'A4',
    margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#888">Enhakkore — Admin User Manual · page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
  });
  await browser.close();
  console.log('PDF written');
})();
