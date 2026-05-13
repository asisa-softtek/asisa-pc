/* eslint-disable no-restricted-syntax, no-await-in-loop, no-continue */
/* eslint-disable no-underscore-dangle, no-console */
/**
 * Descarga y cachea los providers de ASISA en data/providers/{prov}/{spec}.json.
 *
 * Prereq: data/provincias.json (con slug y provinceCode por provincia)
 *
 * Uso:
 *   node generate-providers-data.mjs
 *   FORCE=true node generate-providers-data.mjs        (sobreescribe caché)
 *   PROVINCE_CODE=28 node generate-providers-data.mjs  (solo una provincia)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ASISA_API_KEY = '0908b85b9d0e4a75b2eb33048bd9fe01';
const ASISA_BASE = 'https://ursaepre.asisa.es/ASISA/middlewasisa/public/v1/api/searchPortal';
const CONCURRENCY = 10;
const FORCE = process.env.FORCE === 'true';

function normalize(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function toSlug(str) {
  return normalize(str).replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

async function asisaFetch(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 150000);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'Ocp-Apim-Subscription-Key': ASISA_API_KEY, 'Api-Version': '1' },
    });
    clearTimeout(timeout);
    if (!resp.ok) return { error: resp.status };
    return { data: await resp.json() };
  } catch (e) {
    clearTimeout(timeout);
    return { error: e.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK' };
  }
}

async function fetchSpecialities(provinceCode) {
  const url = `${ASISA_BASE}/autocomplete/specialities?specialityDescription=&networkCode=1&provinceCode=${provinceCode}&maxResultsNumber=200`;
  const result = await asisaFetch(url);
  return result.data || [];
}

async function fetchAllProviders(provinceCode, specDesc, specType) {
  const params = new URLSearchParams({
    networkCode: '1',
    provinceCode,
    pageNumber: '1',
    specialityDescription: specDesc,
    specialityType: String(specType),
  });

  const firstResult = await asisaFetch(`${ASISA_BASE}/providers?${params}`);
  if (!firstResult.data) return { error: firstResult.error };

  const firstPage = firstResult.data;
  const totalCount = firstPage.result?.resultCount || 0;
  let allProviders = firstPage.providerInfo || [];

  const totalPages = Math.ceil(totalCount / 100);
  for (let page = 2; page <= totalPages; page += 1) {
    params.set('pageNumber', String(page));
    const pageResult = await asisaFetch(`${ASISA_BASE}/providers?${params}`);
    if (pageResult.data?.providerInfo) allProviders = allProviders.concat(pageResult.data.providerInfo);
  }

  return { data: allProviders };
}

async function parallelLimit(tasks, limit) {
  const results = [];
  let index = 0;
  async function worker() {
    while (index < tasks.length) {
      const i = index; index += 1;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

async function main() {
  const allProvincias = JSON.parse(readFileSync(join(__dirname, 'data/provincias.json'), 'utf8'));
  const provinceFilter = process.env.PROVINCE_CODE || null;
  const provincias = provinceFilter
    ? allProvincias.filter((p) => String(p.provinceCode) === String(provinceFilter))
    : allProvincias;

  const providersDir = join(__dirname, 'data/providers');
  if (!existsSync(providersDir)) mkdirSync(providersDir, { recursive: true });

  let totalApiCalls = 0;
  let totalNewFiles = 0;
  let totalCachedFiles = 0;

  // Paso 1: especialidades por provincia en paralelo
  console.log(`Paso 1: Especialidades para ${provincias.length} provincias...`);
  const specTasks = provincias.map((prov) => async () => {
    const specs = await fetchSpecialities(prov.provinceCode);
    totalApiCalls += 1;
    return { prov, specs };
  });
  const specsResults = await parallelLimit(specTasks, CONCURRENCY);

  // Paso 2: providers por provincia/especialidad
  console.log('Paso 2: Descargando providers...');
  let completed = 0;
  const totalTasks = specsResults.reduce((acc, { specs }) => {
    const slugs = new Set(specs.map((s) => toSlug(s.specialityDescription)));
    return acc + slugs.size;
  }, 0);

  for (const { prov, specs } of specsResults) {
    if (specs.length === 0) continue;

    const provSlug = prov.slug || toSlug(prov.name);
    const provDir = join(providersDir, provSlug);
    if (!existsSync(provDir)) mkdirSync(provDir, { recursive: true });

    // Agrupar specs por slug (deduplicar variantes del mismo nombre)
    const specsBySlug = new Map();
    for (const spec of specs) {
      const slug = toSlug(spec.specialityDescription);
      if (!specsBySlug.has(slug)) specsBySlug.set(slug, []);
      specsBySlug.get(slug).push(spec);
    }

    const providerTasks = [...specsBySlug.entries()].map(([specSlug, slugSpecs]) => async () => {
      const filePath = join(provDir, `${specSlug}.json`);

      if (!FORCE && existsSync(filePath)) {
        totalCachedFiles += 1;
      } else {
        const allProv = [];
        const seen = new Set();
        for (const spec of slugSpecs) {
          totalApiCalls += 1;
          const result = await fetchAllProviders(
            prov.provinceCode,
            spec.specialityDescription,
            spec.specialityTypeCode,
          );
          if (result.error !== undefined) {
            console.log(`  ✗ [${result.error}] ${prov.name} / ${spec.specialityDescription}`);
            continue;
          }
          const fetched = result.data;
          if (!fetched.length) console.log(`  ✗ [EMPTY] ${prov.name} / ${spec.specialityDescription}`);
          for (const p of fetched) {
            const id = p.providerCode
              || `${p.providerName}|${p.address?.addressDescription}|${p.address?.cityDescription}`;
            if (!seen.has(id)) { seen.add(id); allProv.push(p); }
          }
        }
        writeFileSync(filePath, JSON.stringify(allProv), 'utf8');
        totalNewFiles += 1;
      }

      completed += 1;
      if (completed % 200 === 0 || completed === totalTasks) {
        console.log(`  ${completed}/${totalTasks} (nuevos: ${totalNewFiles}, caché: ${totalCachedFiles})`);
      }
    });

    await parallelLimit(providerTasks, CONCURRENCY);

    console.log(`  [${prov.name}] ${specsBySlug.size} especialidades`);
  }

  console.log('\n--- Peticiones ASISA ---');
  console.log(`  Total:   ${totalApiCalls}`);
  console.log(`  Nuevos:  ${totalNewFiles} ficheros`);
  console.log(`  Caché:   ${totalCachedFiles} ficheros`);
}

main().catch((err) => { console.error('Error:', err); process.exit(1); });
