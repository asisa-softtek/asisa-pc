/* eslint-disable no-underscore-dangle, no-await-in-loop, no-console */
/**
 * Refresca preview y live en EDS para todas las páginas de cuadro médico.
 * - 52 provincias
 * - Localidades válidas (si data/valid-localidades.json existe)
 * - Code refresh (JS/CSS)
 *
 * Uso: node refresh-eds-pages.mjs
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ADMIN_BASE = 'https://admin.hlx.page';
const REPO = 'asisa-softtek/asisa-pc/main';
const CONCURRENCY = 10;
const DELAY_MS = 100;

function toSlug(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function sleep(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

async function refreshUrl(action, path, retries = 3) {
  const url = `${ADMIN_BASE}/${action}/${REPO}${path}`;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const resp = await fetch(url, { method: 'POST' });
      const { status } = resp;
      if (status === 200) {
        console.log(`  OK ${action} ${path}`);
        return status;
      }
      if (status === 401 || status === 404) {
        console.log(`  ${status} ${action} ${path}`);
        return status;
      }
      console.log(`  ${status} ${action} ${path} (attempt ${attempt}/${retries})`);
      if (attempt < retries) await sleep(500 * attempt);
    } catch (e) {
      console.log(`  ERROR ${action} ${path}: ${e.message} (attempt ${attempt}/${retries})`);
      if (attempt < retries) await sleep(500 * attempt);
    }
  }
  console.log(`  FAILED ${action} ${path} after ${retries} attempts`);
  return 0;
}

async function refreshPage(path) {
  await refreshUrl('preview', path);
  await sleep(DELAY_MS);
  await refreshUrl('live', path);
  await sleep(DELAY_MS);
}

async function processInBatches(paths, batchSize) {
  for (let i = 0; i < paths.length; i += batchSize) {
    const batch = paths.slice(i, i + batchSize);
    await Promise.all(batch.map((p) => refreshPage(p)));
  }
}

async function main() {
  console.log('Refreshing code (JS/CSS)...');
  await refreshUrl('code', '');

  // Provincias
  const provincias = JSON.parse(readFileSync(join(__dirname, 'data/provincias.json'), 'utf8'));
  const provinciaPaths = provincias.map((p) => `/cuadro-medico/salud/provincia-de-${toSlug(p.name)}`);

  console.log(`\nRefreshing ${provinciaPaths.length} provincias...`);
  await processInBatches(provinciaPaths, CONCURRENCY);

  // Localidades válidas (generadas desde ASISA)
  const validPath = join(__dirname, 'data/valid-localidades.json');
  if (existsSync(validPath)) {
    const localidades = JSON.parse(readFileSync(validPath, 'utf8'));
    const locPaths = localidades.map((l) => `/cuadro-medico/salud/${l.slug}`);

    console.log(`\nRefreshing ${locPaths.length} localidades...`);
    await processInBatches(locPaths, CONCURRENCY);
  } else {
    console.log('\nNo valid-localidades.json found, skipping localidades.');
  }

  // Provincia + especialidad combos
  const provSpecPath = join(__dirname, 'data/valid-provincia-specs.json');
  if (existsSync(provSpecPath)) {
    const provSpecs = JSON.parse(readFileSync(provSpecPath, 'utf8'));
    const provSpecPaths = provSpecs.map((c) => `/cuadro-medico/salud/${c}`);

    console.log(`\nRefreshing ${provSpecPaths.length} provincia+especialidad...`);
    await processInBatches(provSpecPaths, CONCURRENCY);
  }

  // Municipio + especialidad combos
  const muniSpecPath = join(__dirname, 'data/valid-municipio-specs.json');
  if (existsSync(muniSpecPath)) {
    const muniSpecs = JSON.parse(readFileSync(muniSpecPath, 'utf8'));
    const muniSpecPaths = muniSpecs.map((c) => `/cuadro-medico/salud/${c}`);

    console.log(`\nRefreshing ${muniSpecPaths.length} municipio+especialidad...`);
    await processInBatches(muniSpecPaths, CONCURRENCY);
  }

  // Centros
  const centrosPath = join(__dirname, 'data/valid-centros.json');
  if (existsSync(centrosPath)) {
    const centros = JSON.parse(readFileSync(centrosPath, 'utf8'));
    const centrosPaths = centros.map((c) => `/cuadro-medico/salud/${c}`);

    console.log(`\nRefreshing ${centrosPaths.length} centros...`);
    await processInBatches(centrosPaths, CONCURRENCY);
  }

  // Especialistas
  const espPath = join(__dirname, 'data/valid-especialistas.json');
  if (existsSync(espPath)) {
    const especialistas = JSON.parse(readFileSync(espPath, 'utf8'));
    const espPaths = especialistas.map((e) => `/cuadro-medico/salud/${e}`);

    console.log(`\nRefreshing ${espPaths.length} especialistas...`);
    await processInBatches(espPaths, CONCURRENCY);
  }

  console.log('\nDone!');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
