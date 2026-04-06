/* eslint-disable no-restricted-syntax, no-await-in-loop, no-continue */
/* eslint-disable no-underscore-dangle, no-console */
/**
 * Genera localidades con proveedores ASISA directamente desde la API.
 *
 * Recorre todas las provincias y especialidades, extrae los cityDescription
 * únicos de cada proveedor y genera:
 *  - data/valid-localidades.json
 *
 * Cuando EP-02b esté disponible (specialityDescription opcional), se podrá
 * simplificar eliminando el bucle de especialidades.
 *
 * Uso: node generate-localidades.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ASISA_API_KEY = '0908b85b9d0e4a75b2eb33048bd9fe01';
const ASISA_BASE = 'https://ursaepre.asisa.es/ASISA/middlewasisa/public/v1/api/searchPortal';

function toSlug(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function toDisplayName(cityDesc) {
  // "ALICANTE/ALACANT" → "Alicante/Alacant"
  // "EJIDO (EL)" → "Ejido (El)"
  // "MAGALUF" → "Magaluf"
  return cityDesc
    .toLowerCase()
    .replace(/(?:^|\s|\/|-|\()([a-záéíóúüñ])/g, (_, c) => _.slice(0, -1) + c.toUpperCase());
}

function sleep(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
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

async function fetchProviderCities(provinceCode, specDesc, specType) {
  const cities = new Set();
  const params = new URLSearchParams({
    networkCode: '1',
    provinceCode,
    pageNumber: '1',
    specialityDescription: specDesc,
    specialityType: String(specType),
  });

  const firstPage = await asisaFetch(`${ASISA_BASE}/providers?${params}`);
  if (!firstPage) return cities;

  const totalCount = firstPage.result?.resultCount || 0;
  for (const p of (firstPage.providerInfo || [])) {
    const city = p.address?.cityDescription;
    if (city) cities.add(city.trim());
  }

  const totalPages = Math.ceil(totalCount / 100);
  for (let page = 2; page <= totalPages; page += 1) {
    params.set('pageNumber', String(page));
    const pageData = await asisaFetch(`${ASISA_BASE}/providers?${params}`);
    for (const p of (pageData?.providerInfo || [])) {
      const city = p.address?.cityDescription;
      if (city) cities.add(city.trim());
    }
  }

  return cities;
}

async function main() {
  const provincias = JSON.parse(readFileSync(join(__dirname, 'data/provincias.json'), 'utf8'));

  // Map provinceCode → provincia name for output
  const provNameMap = new Map();
  for (const p of provincias) provNameMap.set(p.provinceCode, p.name);

  // Collect all unique cityDescription per province
  // Key: "CITYNAME|provinceCode" → cityDescription (original case from ASISA)
  const allCities = new Map();
  let processed = 0;

  for (const prov of provincias) {
    processed += 1;
    console.log(`[${processed}/${provincias.length}] ${prov.name} (${prov.provinceCode})...`);

    const specialities = await fetchSpecialities(prov.provinceCode);
    if (specialities.length === 0) {
      console.log('  Sin especialidades');
      continue;
    }

    const provinceCities = new Set();

    for (let i = 0; i < specialities.length; i += 1) {
      const spec = specialities[i];
      const cities = await fetchProviderCities(
        prov.provinceCode,
        spec.specialityDescription,
        spec.specialityTypeCode,
      );
      for (const c of cities) provinceCities.add(c);
      if (i < specialities.length - 1) await sleep(500);
    }

    for (const city of provinceCities) {
      const key = `${city}|${prov.provinceCode}`;
      if (!allCities.has(key)) {
        allCities.set(key, { cityDescription: city, provinceCode: prov.provinceCode });
      }
    }

    console.log(`  ${provinceCities.size} localidades`);
  }

  // Build output array
  const localidades = [];
  for (const entry of allCities.values()) {
    const slug = toSlug(entry.cityDescription);
    if (!slug) continue; // skip empty slugs
    localidades.push({
      slug,
      cityDescription: entry.cityDescription,
      displayName: toDisplayName(entry.cityDescription),
      provinceCode: entry.provinceCode,
      provincia: provNameMap.get(entry.provinceCode) || '',
    });
  }

  // Sort by slug for deterministic output
  localidades.sort((a, b) => a.slug.localeCompare(b.slug) || a.provinceCode.localeCompare(b.provinceCode));

  // Check for duplicate slugs (different cities that produce the same slug)
  const slugCount = new Map();
  for (const loc of localidades) {
    const count = slugCount.get(loc.slug) || 0;
    slugCount.set(loc.slug, count + 1);
  }
  const duplicates = [...slugCount.entries()].filter(([, c]) => c > 1);
  if (duplicates.length > 0) {
    console.log(`\n⚠ ${duplicates.length} slugs duplicados (misma localidad en varias provincias):`);
    for (const [slug, count] of duplicates.slice(0, 20)) {
      const entries = localidades.filter((l) => l.slug === slug);
      console.log(`  "${slug}" (${count}): ${entries.map((e) => `${e.cityDescription} [${e.provincia}]`).join(', ')}`);
    }
    if (duplicates.length > 20) console.log(`  ... y ${duplicates.length - 20} más`);
  }

  writeFileSync(
    join(__dirname, 'data/valid-localidades.json'),
    JSON.stringify(localidades, null, 2),
    'utf8',
  );
  console.log(`\nGenerado: data/valid-localidades.json: ${localidades.length} localidades`);
}

main().catch((err) => { console.error('Error:', err); process.exit(1); });
