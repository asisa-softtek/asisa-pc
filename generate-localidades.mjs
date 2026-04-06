/* eslint-disable no-restricted-syntax, no-await-in-loop, no-continue */
/* eslint-disable no-underscore-dangle, no-console */
/**
 * Hace UN SOLO pase contra ASISA y genera:
 *  - data/valid-localidades.json          (localidades con cobertura)
 *  - data/providers/{prov}/{spec}.json    (médicos pre-cacheados por provincia/especialidad)
 *
 * Uso: node generate-localidades.mjs
 * Forzar sobreescritura: FORCE=true node generate-localidades.mjs
 * Solo una provincia:    PROVINCE_CODE=28 node generate-localidades.mjs
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

function toDisplayName(cityDesc) {
  return cityDesc
    .toLowerCase()
    .replace(/(?:^|\s|\/|-|\()([a-záéíóúüñ])/g, (_, c) => _.slice(0, -1) + c.toUpperCase());
}

async function asisaFetch(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'Ocp-Apim-Subscription-Key': ASISA_API_KEY, 'Api-Version': '1' },
    });
    clearTimeout(timeout);
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

async function fetchSpecialities(provinceCode) {
  const url = `${ASISA_BASE}/autocomplete/specialities?specialityDescription=&networkCode=1&provinceCode=${provinceCode}&maxResultsNumber=200`;
  return (await asisaFetch(url)) || [];
}

/**
 * Descarga TODOS los médicos de una combinación provincia+especialidad (con paginación).
 * Devuelve el array completo de providerInfo.
 */
async function fetchAllProviders(provinceCode, specDesc, specType) {
  const params = new URLSearchParams({
    networkCode: '1',
    provinceCode,
    pageNumber: '1',
    specialityDescription: specDesc,
    specialityType: String(specType),
  });

  const firstPage = await asisaFetch(`${ASISA_BASE}/providers?${params}`);
  if (!firstPage) return [];

  const totalCount = firstPage.result?.resultCount || 0;
  let allProviders = firstPage.providerInfo || [];

  const totalPages = Math.ceil(totalCount / 100);
  for (let page = 2; page <= totalPages; page += 1) {
    params.set('pageNumber', String(page));
    const pageData = await asisaFetch(`${ASISA_BASE}/providers?${params}`);
    if (pageData?.providerInfo) {
      allProviders = allProviders.concat(pageData.providerInfo);
    }
  }

  return allProviders;
}

async function parallelLimit(tasks, limit) {
  const results = [];
  let index = 0;
  async function worker() {
    while (index < tasks.length) {
      const i = index;
      index += 1;
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

  const provNameMap = new Map();
  for (const p of allProvincias) provNameMap.set(p.provinceCode, p.name);

  // Directorio de providers pre-cacheados
  const providersDir = join(__dirname, 'data/providers');
  if (!existsSync(providersDir)) mkdirSync(providersDir, { recursive: true });

  // Acumulador de localidades
  const allCities = new Map(); // key: "cityDesc|provCode" → { cityDescription, provinceCode }

  // Estadísticas
  let totalApiCalls = 0;
  let totalProviderFiles = 0;
  let totalCachedFiles = 0;

  console.log(`Paso 1: Obteniendo especialidades para ${provincias.length} provincias...`);
  totalApiCalls += provincias.length;

  const specTasks = provincias.map((prov) => async () => {
    const specs = await fetchSpecialities(prov.provinceCode);
    return { prov, specs };
  });

  const specsResults = await parallelLimit(specTasks, CONCURRENCY);

  // Construir lista de tareas agrupadas por slug para evitar llamadas duplicadas
  console.log('Paso 2: Construyendo tareas de providers (agrupadas por slug)...');
  const providerTasks = [];

  for (const { prov, specs } of specsResults) {
    const provSlug = toSlug(prov.name);
    const provDir = join(providersDir, provSlug);
    if (!existsSync(provDir)) mkdirSync(provDir, { recursive: true });

    // Agrupar specs por slug para fusionar duplicados de ASISA en 1 sola llamada
    const specsBySlug = new Map();
    for (const spec of specs) {
      const slug = toSlug(spec.specialityDescription);
      if (!specsBySlug.has(slug)) specsBySlug.set(slug, []);
      specsBySlug.get(slug).push(spec);
    }

    for (const [specSlug, slugSpecs] of specsBySlug.entries()) {
      const filePath = join(provDir, `${specSlug}.json`);

      providerTasks.push(async () => {
        // Si existe y no forzamos, leer del disco y extraer ciudades
        if (!FORCE && existsSync(filePath)) {
          totalCachedFiles += 1;
          const cached = JSON.parse(readFileSync(filePath, 'utf8'));
          for (const p of cached) {
            const city = p.address?.cityDescription;
            if (city) {
              const key = `${city.trim()}|${prov.provinceCode}`;
              if (!allCities.has(key)) allCities.set(key, { cityDescription: city.trim(), provinceCode: prov.provinceCode });
            }
          }
          return;
        }

        // Llamar a providers para todos los specs con el mismo slug y deduplicar
        const allProv = [];
        const seen = new Set();
        for (const spec of slugSpecs) {
          totalApiCalls += 1;
          const providers = await fetchAllProviders(
            prov.provinceCode,
            spec.specialityDescription,
            spec.specialityTypeCode,
          );
          for (const p of providers) {
            const id = p.providerCode
              || `${p.providerName}|${p.address?.addressDescription}|${p.address?.cityDescription}`;
            if (!seen.has(id)) {
              seen.add(id);
              allProv.push(p);
            }
          }
        }

        // Guardar en disco
        writeFileSync(filePath, JSON.stringify(allProv), 'utf8');
        totalProviderFiles += 1;

        // Extraer ciudades
        for (const p of allProv) {
          const city = p.address?.cityDescription;
          if (city) {
            const key = `${city.trim()}|${prov.provinceCode}`;
            if (!allCities.has(key)) allCities.set(key, { cityDescription: city.trim(), provinceCode: prov.provinceCode });
          }
        }
      });
    }
  }

  console.log(`Total tareas de providers: ${providerTasks.length} (FORCE=${FORCE})`);

  let completed = 0;
  const wrappedTasks = providerTasks.map((task) => async () => {
    await task();
    completed += 1;
    if (completed % 100 === 0 || completed === providerTasks.length) {
      console.log(`  Progreso: ${completed} / ${providerTasks.length}`);
    }
  });

  await parallelLimit(wrappedTasks, CONCURRENCY);

  // Construir y escribir valid-localidades.json (solo si no es filtro de provincia parcial)
  if (!provinceFilter) {
    const localidades = [];
    for (const entry of allCities.values()) {
      const slug = toSlug(entry.cityDescription);
      if (!slug) continue;
      localidades.push({
        slug,
        cityDescription: entry.cityDescription,
        displayName: toDisplayName(entry.cityDescription),
        provinceCode: entry.provinceCode,
        provincia: provNameMap.get(entry.provinceCode) || '',
      });
    }

    localidades.sort((a, b) => a.slug.localeCompare(b.slug) || a.provinceCode.localeCompare(b.provinceCode));

    // Informar slugs duplicados
    const slugCount = new Map();
    for (const loc of localidades) slugCount.set(loc.slug, (slugCount.get(loc.slug) || 0) + 1);
    const duplicates
