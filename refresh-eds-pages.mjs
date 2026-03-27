/* eslint-disable no-underscore-dangle, no-await-in-loop, no-console */
/**
 * Refresca preview y live en EDS para todas las páginas de cuadro médico.
 * - 52 provincias
 * - Municipios válidos (si data/valid-municipios.json existe)
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
const CONCURRENCY = 3;
const DELAY_MS = 500;

function toSlug(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-');
}

function sleep(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

async function refreshUrl(action, path) {
  const url = `${ADMIN_BASE}/${action}/${REPO}${path}`;
  try {
    const resp = await fetch(url, { method: 'POST' });
    const { status } = resp;
    if (status === 200) {
      console.log(`  OK ${action} ${path}`);
    } else {
      console.log(`  ${status} ${action} ${path}`);
    }
    return status;
  } catch (e) {
    console.log(`  ERROR ${action} ${path}: ${e.message}`);
    return 0;
  }
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

  // Municipios válidos
  const validPath = join(__dirname, 'data/valid-municipios.json');
  if (existsSync(validPath)) {
    const municipios = JSON.parse(readFileSync(validPath, 'utf8'));
    const muniPaths = municipios.map((m) => `/cuadro-medico/salud/${toSlug(m)}`);

    console.log(`\nRefreshing ${muniPaths.length} municipios...`);
    await processInBatches(muniPaths, CONCURRENCY);
  } else {
    console.log('\nNo valid-municipios.json found, skipping municipios.');
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
