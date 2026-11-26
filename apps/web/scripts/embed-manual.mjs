// Copies docs/ADMIN-MANUAL.md into the web bundle so /admin/help never needs
// to read the file system at run time. Runs before every build.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(here, '../../../docs/ADMIN-MANUAL.md');
const target = path.resolve(here, '../src/content/admin-manual.generated.ts');
mkdirSync(path.dirname(target), { recursive: true });
writeFileSync(target, `// Generated from docs/ADMIN-MANUAL.md by scripts/embed-manual.mjs — do not edit.\nexport const ADMIN_MANUAL = ${JSON.stringify(readFileSync(source, 'utf8'))};\n`);
