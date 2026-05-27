/* eslint-disable no-underscore-dangle, no-await-in-loop, no-console */
/**
 * Refresca preview y live en EDS para las páginas de cuadro médico.
 *
 * Uso:
 *   node refresh-eds-pages.mjs                   # todo (provincias + specs + doctores + centros + especialidades)
 *   node refresh-eds-pages.mjs --code            # solo JS/CSS (segundos)
 *   node refresh-eds-pages.mjs --provincias      # páginas /p/{slug}
 *   node refresh-eds-pages.mjs --specs           # páginas /p/{prov}/pe/{spec}
 *   node refresh-eds-pages.mjs --doctores        # páginas /d/{key}
 *   node refresh-eds-pages.mjs --centros         # páginas /c/{key}
 *   node refresh-eds-pages.mjs --especialidades  # páginas /e/{slug}
 *   node refresh-eds-pages.mjs --sitemaps        # /sitemap.xml + los 5 /sitemap-cuadro-medico-*.xml
 *   node refresh-eds-pages.mjs --province=madrid # solo una provincia + sus specs
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ADMIN_BASE = 'https://admin.hlx.page';
const REPO = 'asisa-softtek/asisa-pc/main';
const CONCURRENCY = 10;
const DELAY_MS = 100;

const ADMIN_TOKEN = process.env.HLX_ADMIN_API_TOKEN || '';

// --- CLI flags ---
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--') && !a.includes('=')));
const opts = Object.fromEntries(args.filter((a) => a.includes('=')).map((a) => a.replace('--', '').split('=')));

const MODE_CODE = flags.has('--code');
const MODE_PROVINCIAS = flags.has('--provincias');
const MODE_SPECS = flags.has('--specs');
const MODE_DOCTORES = flags.has('--doctores');
const MODE_CENTROS = flags.has('--centros');
const MODE_ESPECIALIDADES = flags.has('--especialidades');
const MODE_SITEMAPS = flags.has('--sitemaps');
const PROVINCE_FILTER = opts.province || null;
const MODE_FULL = !MODE_CODE && !MODE_PROVINCIAS && !MODE_SPECS
  && !MODE_DOCTORES && !MODE_CENTROS && !MODE_ESPECIALIDADES && !MODE_SITEMAPS && !PROVINCE_FILTER;

// -----------------

function sleep(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

async function refreshUrl(action, path, retries = 3) {
  const url = `${ADMIN_BASE}/${action}/${REPO}${path}`;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'x-auth-token': ADMIN_TOKEN },
      });
      const { status } = resp;
      if (status === 200) { console.log(`  OK ${action} ${path}`); return status; }
      if (status === 401 || status === 404) { console.log(`  ${status} ${action} ${path}`); return status; }
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

async function refreshCode() {
  console.log('Refreshing code (JS/CSS)...');
  await refreshUrl('code', '');
}

async function refreshProvincias(filter = null) {
  const provincias = JSON.parse(readFileSync(join(__dirname, 'data/provincias.json'), 'utf8'));
  const paths = provincias
    .filter((p) => !filter || p.slug === filter)
    .map((p) => `/cuadro-medico/p/${p.slug}`);
  console.log(`\nRefreshing ${paths.length} provincias...`);
  await processInBatches(paths, CONCURRENCY);
}

async function refreshSpecs(filter = null) {
  const provinciasDir = join(__dirname, 'data/cuadro-medico/provincias');
  if (!existsSync(provinciasDir)) return;
  const paths = [];
  for (const file of readdirSync(provinciasDir).filter((f) => f.endsWith('.json'))) {
    const provSlug = file.replace('.json', '');
    if (filter && provSlug !== filter) continue;
    const data = JSON.parse(readFileSync(join(provinciasDir, file), 'utf8'));
    for (const specSlug of data.especialidades || []) {
      paths.push(`/cuadro-medico/p/${provSlug}/pe/${specSlug}`);
    }
  }
  console.log(`\nRefreshing ${paths.length} provincia+especialidad...`);
  await processInBatches(paths, CONCURRENCY);
}

async function refreshDoctores() {
  const indexPath = join(__dirname, 'data/cuadro-medico/doctores-index.json');
  if (!existsSync(indexPath)) return;
  const paths = Object.keys(JSON.parse(readFileSync(indexPath, 'utf8')))
    .map((k) => `/cuadro-medico/d/${k}`);
  console.log(`\nRefreshing ${paths.length} doctores...`);
  await processInBatches(paths, CONCURRENCY);
}

async function refreshCentros() {
  const indexPath = join(__dirname, 'data/cuadro-medico/centros-index.json');
  if (!existsSync(indexPath)) return;
  const paths = Object.keys(JSON.parse(readFileSync(indexPath, 'utf8')))
    .map((k) => `/cuadro-medico/c/${k}`);
  console.log(`\nRefreshing ${paths.length} centros...`);
  await processInBatches(paths, CONCURRENCY);
}

async function refreshEspecialidades() {
  const especDir = join(__dirname, 'data/cuadro-medico/especialidades');
  if (!existsSync(especDir)) return;
  const paths = readdirSync(especDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => `/cuadro-medico/e/${f.replace('.json', '')}`);
  console.log(`\nRefreshing ${paths.length} especialidades...`);
  await processInBatches(paths, CONCURRENCY);
}

async function refreshSitemaps() {
  const paths = [
    '/sitemap.xml',
    '/sitemap-cuadro-medico-provincias.xml',
    '/sitemap-cuadro-medico-provincia-specs.xml',
    '/sitemap-cuadro-medico-doctores.xml',
    '/sitemap-cuadro-medico-centros.xml',
    '/sitemap-cuadro-medico-especialidades.xml',
  ];
  console.log(`\nRefreshing ${paths.length} sitemaps...`);
  for (const p of paths) await refreshPage(p);
}

async function main() {
  if (PROVINCE_FILTER) {
    console.log(`Mode: province=${PROVINCE_FILTER}`);
    await refreshCode();
    await refreshProvincias(PROVINCE_FILTER);
    await refreshSpecs(PROVINCE_FILTER);
    console.log('\nDone!');
    return;
  }

  if (MODE_CODE) {
    await refreshCode();
    console.log('\nDone!');
    return;
  }

  await refreshCode();

  if (MODE_FULL || MODE_PROVINCIAS) await refreshProvincias();
  if (MODE_FULL || MODE_SPECS) await refreshSpecs();
  if (MODE_FULL || MODE_DOCTORES) await refreshDoctores();
  if (MODE_FULL || MODE_CENTROS) await refreshCentros();
  if (MODE_FULL || MODE_ESPECIALIDADES) await refreshEspecialidades();
  if (MODE_FULL || MODE_SITEMAPS) await refreshSitemaps();

  console.log('\nDone!');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
