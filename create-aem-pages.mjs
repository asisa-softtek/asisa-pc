/* eslint-disable no-await-in-loop, no-console */
/**
 * Crea páginas en AEM copiando las plantillas del cuadro médico,
 * las publica y refresca EDS.
 *
 * Uso:
 *   AEM_TOKEN="login:eyJ..." node create-aem-pages.mjs --provincias
 *   AEM_TOKEN="login:eyJ..." node create-aem-pages.mjs --doctores
 *   AEM_TOKEN="login:eyJ..." node create-aem-pages.mjs --centros
 *   AEM_TOKEN="login:eyJ..." node create-aem-pages.mjs --especialidades
 *   AEM_TOKEN="login:eyJ..." node create-aem-pages.mjs --all
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const AEM_BASE = 'https://author-p133185-e1320482.adobeaemcloud.com';
const AEM_CONTENT = '/content/site-pc';
const ADMIN_BASE = 'https://admin.hlx.page';
const REPO = 'asisa-softtek/asisa-pc/main';
const CONCURRENCY = 5;
const DELAY_MS = 200;

const TOKEN = process.env.AEM_TOKEN;
if (!TOKEN) { console.error('AEM_TOKEN requerido'); process.exit(1); }

const args = process.argv.slice(2);
const DO_PROVINCIAS = args.includes('--provincias') || args.includes('--all');
const DO_DOCTORES = args.includes('--doctores') || args.includes('--all');
const DO_CENTROS = args.includes('--centros') || args.includes('--all');
const DO_ESPECIALIDADES = args.includes('--especialidades') || args.includes('--all');

function sleep(ms) { return new Promise((r) => { setTimeout(r, ms); }); }

function aemHeaders() {
  return { Cookie: `login-token=${encodeURIComponent(TOKEN)}`, 'Content-Type': 'application/x-www-form-urlencoded' };
}

async function aemPageExists(path) {
  const r = await fetch(`${AEM_BASE}${path}.infinity.json`, { headers: aemHeaders() });
  return r.ok;
}

async function copyPage(srcPath, destParentPath, pageName) {
  const body = new URLSearchParams({
    cmd: 'copyPage',
    srcPath,
    destParentPath,
    pageName,
    shallow: 'false',
    replaceExistingPages: 'false',
  });
  const r = await fetch(`${AEM_BASE}/bin/wcmcommand`, {
    method: 'POST', headers: aemHeaders(), body: body.toString(),
  });
  return r.ok || r.status === 200;
}

async function publishPage(path) {
  const body = new URLSearchParams({ path, cmd: 'activate' });
  const r = await fetch(`${AEM_BASE}/bin/replicate.json`, {
    method: 'POST', headers: aemHeaders(), body: body.toString(),
  });
  return r.ok;
}

async function edsRefresh(edsPath) {
  await fetch(`${ADMIN_BASE}/preview/${REPO}${edsPath}`, { method: 'POST' });
  await sleep(50);
  await fetch(`${ADMIN_BASE}/live/${REPO}${edsPath}`, { method: 'POST' });
}

async function processInBatches(items, batchSize, fn) {
  for (let i = 0; i < items.length; i += batchSize) {
    await Promise.all(items.slice(i, i + batchSize).map(fn));
    await sleep(DELAY_MS);
  }
}

async function createPage(srcAemPath, destParentAemPath, pageName, edsPath) {
  const destPath = `${destParentAemPath}/${pageName}`;
  const exists = await aemPageExists(destPath);
  if (!exists) {
    const ok = await copyPage(srcAemPath, destParentAemPath, pageName);
    if (!ok) { console.log(`  FAIL copy ${destPath}`); return; }
  }
  await publishPage(destPath);
  await edsRefresh(edsPath);
  console.log(`  OK ${edsPath}`);
}

async function main() {
  if (DO_PROVINCIAS) {
    const provincias = JSON.parse(readFileSync(join(__dirname, 'data/provincias.json'), 'utf8'));
    console.log(`\nCreando ${provincias.length} páginas de provincia...`);
    await processInBatches(provincias, CONCURRENCY, async (p) => {
      await createPage(
        `${AEM_CONTENT}/cuadro-medico/provincia`,
        `${AEM_CONTENT}/cuadro-medico/p`,
        p.slug,
        `/cuadro-medico/p/${p.slug}`,
      );
    });

    // Provincia + especialidad
    const provinciasDir = join(__dirname, 'data/cuadro-medico/provincias');
    if (existsSync(provinciasDir)) {
      const provSpecItems = [];
      for (const file of readdirSync(provinciasDir).filter((f) => f.endsWith('.json'))) {
        const provSlug = file.replace('.json', '');
        const data = JSON.parse(readFileSync(join(provinciasDir, file), 'utf8'));
        for (const specSlug of data.especialidades || []) {
          provSpecItems.push({ provSlug, specSlug });
        }
      }
      console.log(`\nCreando ${provSpecItems.length} páginas provincia+especialidad...`);
      await processInBatches(provSpecItems, CONCURRENCY, async ({ provSlug, specSlug }) => {
        await createPage(
          `${AEM_CONTENT}/cuadro-medico/provincia`,
          `${AEM_CONTENT}/cuadro-medico/p/${provSlug}/pe`,
          specSlug,
          `/cuadro-medico/p/${provSlug}/pe/${specSlug}`,
        );
      });
    }
  }

  if (DO_ESPECIALIDADES) {
    const especDir = join(__dirname, 'data/cuadro-medico/especialidades');
    if (existsSync(especDir)) {
      const slugs = readdirSync(especDir).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
      console.log(`\nCreando ${slugs.length} páginas de especialidad...`);
      await processInBatches(slugs, CONCURRENCY, async (slug) => {
        await createPage(
          `${AEM_CONTENT}/cuadro-medico/especialidad`,
          `${AEM_CONTENT}/cuadro-medico/e`,
          slug,
          `/cuadro-medico/e/${slug}`,
        );
      });
    }
  }

  if (DO_DOCTORES) {
    const indexPath = join(__dirname, 'data/cuadro-medico/doctores-index.json');
    if (existsSync(indexPath)) {
      const keys = Object.keys(JSON.parse(readFileSync(indexPath, 'utf8')));
      console.log(`\nCreando ${keys.length} páginas de doctor...`);
      await processInBatches(keys, CONCURRENCY, async (key) => {
        await createPage(
          `${AEM_CONTENT}/cuadro-medico/doctor`,
          `${AEM_CONTENT}/cuadro-medico/d`,
          key,
          `/cuadro-medico/d/${key}`,
        );
      });
    }
  }

  if (DO_CENTROS) {
    const indexPath = join(__dirname, 'data/cuadro-medico/centros-index.json');
    if (existsSync(indexPath)) {
      const keys = Object.keys(JSON.parse(readFileSync(indexPath, 'utf8')));
      console.log(`\nCreando ${keys.length} páginas de centro...`);
      await processInBatches(keys, CONCURRENCY, async (key) => {
        await createPage(
          `${AEM_CONTENT}/cuadro-medico/centro`,
          `${AEM_CONTENT}/cuadro-medico/c`,
          key,
          `/cuadro-medico/c/${key}`,
        );
      });
    }
  }

  console.log('\nDone!');
}

main().catch((err) => { console.error(err); process.exit(1); });
