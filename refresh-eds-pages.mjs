/* eslint-disable no-underscore-dangle, no-await-in-loop, no-console */
/**
 * Refresca preview y live en EDS para todas las páginas de cuadro médico.
 *
 * Uso: node refresh-eds-pages.mjs
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ADMIN_BASE = 'https://admin.hlx.page';
const REPO = 'asisa-softtek/asisa-pc/main';
const CONCURRENCY = 10;
const DELAY_MS = 100;

const ADMIN_TOKEN = process.env.HLX_ADMIN_API_TOKEN;
if (!ADMIN_TOKEN) {
  console.error('ERROR: HLX_ADMIN_API_TOKEN env var is required');
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

async function refreshUrl(action, path, retries = 3) {
  const url = `${ADMIN_BASE}/${action}/${REPO}${path}`;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'x-auth-token': ADMIN_TOKEN },
      });
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

  // Provincias — /cuadro-medico/p/{slug}
  const provincias = JSON.parse(readFileSync(join(__dirname, 'data/provincias.json'), 'utf8'));
  const provinciaPaths = provincias.map((p) => `/cuadro-medico/p/${p.slug}`);

  console.log(`\nRefreshing ${provinciaPaths.length} provincias...`);
  await processInBatches(provinciaPaths, CONCURRENCY);

  // Provincia + especialidad — /cuadro-medico/p/{prov}/pe/{spec}
  const provinciasDir = join(__dirname, 'data/cuadro-medico/provincias');
  if (existsSync(provinciasDir)) {
    const provSpecPaths = [];
    for (const file of readdirSync(provinciasDir).filter((f) => f.endsWith('.json'))) {
      const provSlug = file.replace('.json', '');
      const data = JSON.parse(readFileSync(join(provinciasDir, file), 'utf8'));
      for (const specSlug of data.especialidades || []) {
        provSpecPaths.push(`/cuadro-medico/p/${provSlug}/pe/${specSlug}`);
      }
    }
    console.log(`\nRefreshing ${provSpecPaths.length} provincia+especialidad...`);
    await processInBatches(provSpecPaths, CONCURRENCY);
  }

  // Doctores — /cuadro-medico/d/{key}
  const doctoresPath = join(__dirname, 'data/cuadro-medico/doctores-index.json');
  if (existsSync(doctoresPath)) {
    const doctores = JSON.parse(readFileSync(doctoresPath, 'utf8'));
    const doctoresPaths = Object.keys(doctores).map((k) => `/cuadro-medico/d/${k}`);
    console.log(`\nRefreshing ${doctoresPaths.length} doctores...`);
    await processInBatches(doctoresPaths, CONCURRENCY);
  }

  // Centros — /cuadro-medico/c/{key}
  const centrosPath = join(__dirname, 'data/cuadro-medico/centros-index.json');
  if (existsSync(centrosPath)) {
    const centros = JSON.parse(readFileSync(centrosPath, 'utf8'));
    const centrosPaths = Object.keys(centros).map((k) => `/cuadro-medico/c/${k}`);
    console.log(`\nRefreshing ${centrosPaths.length} centros...`);
    await processInBatches(centrosPaths, CONCURRENCY);
  }

  // Especialidades — /cuadro-medico/e/{slug}
  const especDir = join(__dirname, 'data/cuadro-medico/especialidades');
  if (existsSync(especDir)) {
    const especPaths = readdirSync(especDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => `/cuadro-medico/e/${f.replace('.json', '')}`);
    console.log(`\nRefreshing ${especPaths.length} especialidades...`);
    await processInBatches(especPaths, CONCURRENCY);
  }

  console.log('\nDone!');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
