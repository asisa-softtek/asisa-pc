/* eslint-disable no-console */
/**
 * Combina los archivos parciales especialistas-partial-{code}.json
 * en data/valid-especialistas.json y data/especialistas-index.json
 *
 * Uso: node merge-especialistas.mjs
 */

import { readdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, 'data');

const partialFiles = readdirSync(dataDir).filter((f) => f.startsWith('especialistas-partial-') && f.endsWith('.json'));

if (partialFiles.length === 0) {
  console.error('No se encontraron archivos parciales especialistas-partial-*.json');
  process.exit(1);
}

console.log(`Combinando ${partialFiles.length} archivos parciales...`);

const allUrls = new Set();
const allIndex = {};

for (const file of partialFiles) {
  const { urls, index } = JSON.parse(readFileSync(join(dataDir, file), 'utf8'));
  for (const url of urls) allUrls.add(url);
  Object.assign(allIndex, index);
}

const urlList = [...allUrls].sort();
writeFileSync(join(dataDir, 'valid-especialistas.json'), JSON.stringify(urlList, null, 2), 'utf8');
writeFileSync(join(dataDir, 'especialistas-index.json'), JSON.stringify(allIndex), 'utf8');

for (const file of partialFiles) unlinkSync(join(dataDir, file));

console.log(`valid-especialistas.json: ${urlList.length} URLs`);
console.log(`especialistas-index.json: ${Object.keys(allIndex).length} entries`);
