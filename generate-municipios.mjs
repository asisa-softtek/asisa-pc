/* eslint-disable no-restricted-syntax, no-await-in-loop, no-continue */
/* eslint-disable no-underscore-dangle, no-console */
/**
 * Genera municipios con proveedores ASISA.
 *  - data/valid-municipios.json
 *
 * Consulta 2 especialidades por provincia para validar municipios.
 * Uso: node generate-municipios.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ASISA_API_KEY = '0908b85b9d0e4a75b2eb33048bd9fe01';
const ASISA_BASE = 'https://ursaepre.asisa.es/ASISA/middlewasisa/public/v1/api/searchPortal';

function normalize(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
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
    if (city) cities.add(normalize(city));
  }

  const totalPages = Math.ceil(totalCount / 100);
  for (let page = 2; page <= totalPages; page += 1) {
    params.set('pageNumber', String(page));
    const pageData = await asisaFetch(`${ASISA_BASE}/providers?${params}`);
    for (const p of (pageData?.providerInfo || [])) {
      const city = p.address?.cityDescription;
      if (city) cities.add(normalize(city));
    }
  }

  return cities;
}

async function main() {
  const provincias = JSON.parse(readFileSync(join(__dirname, 'data/provincias.json'), 'utf8'));
  const municipios = JSON.parse(readFileSync(join(__dirname, 'data/municipios.json'), 'utf8'));

  const muniMap = new Map();
  for (const m of municipios) {
    muniMap.set(`${normalize(m.municipio)}|${m.provinceCode}`, m.municipio);
  }

  const validMunicipios = new Set();
  let processed = 0;

  for (const prov of provincias) {
    processed += 1;
    console.log(`[${processed}/${provincias.length}] ${prov.name}...`);

    const specialities = await fetchSpecialities(prov.provinceCode);
    if (specialities.length === 0) { console.log('  Sin especialidades'); continue; }

    const specsToCheck = specialities.slice(0, 2);
    const citySet = new Set();

    for (let i = 0; i < specsToCheck.length; i += 1) {
      const spec = specsToCheck[i];
      const cities = await fetchProviderCities(
        prov.provinceCode,
        spec.specialityDescription,
        spec.specialityTypeCode,
      );
      for (const c of cities) citySet.add(c);
      if (i < specsToCheck.length - 1) await sleep(500);
    }

    for (const city of citySet) {
      const key = `${city}|${prov.provinceCode}`;
      if (muniMap.has(key)) validMunicipios.add(muniMap.get(key));
    }

    console.log(`  ${citySet.size} ciudades`);
  }

  const validList = [...validMunicipios].sort();
  writeFileSync(join(__dirname, 'data/valid-municipios.json'), JSON.stringify(validList, null, 2), 'utf8');
  console.log(`\nGenerado: valid-municipios.json: ${validList.length} municipios`);
}

main().catch((err) => { console.error('Error:', err); process.exit(1); });
