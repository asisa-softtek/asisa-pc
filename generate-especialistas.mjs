/* eslint-disable no-restricted-syntax, no-await-in-loop, no-continue */
/* eslint-disable no-underscore-dangle, no-console */
/**
 * Genera datos de especialistas/profesionales (doctorType === 1):
 *  - data/valid-especialistas.json    (URLs)
 *  - data/especialistas-index.json    (info + especialidades por profesional)
 *
 * Recorre TODAS las especialidades (page 1) por provincia.
 * Genera URLs para provincia Y municipio.
 *
 * Uso: node generate-especialistas.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ASISA_API_KEY = '0908b85b9d0e4a75b2eb33048bd9fe01';
const ASISA_BASE = 'https://ursaepre.asisa.es/ASISA/middlewasisa/public/v1/api/searchPortal';
const CONCURRENCY = 3;

function normalize(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function toSlug(str) {
  return normalize(str).replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function sleep(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

async function asisaFetch(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
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
  const url = `${ASISA_BASE}/autocomplete/specialities`
    + '?specialityDescription=&networkCode=1'
    + `&provinceCode=${provinceCode}&maxResultsNumber=200`;
  return (await asisaFetch(url)) || [];
}

async function fetchProvidersPage1(provinceCode, specDesc, specType) {
  const params = new URLSearchParams({
    networkCode: '1',
    provinceCode,
    pageNumber: '1',
    specialityDescription: specDesc,
    specialityType: String(specType),
  });
  const data = await asisaFetch(`${ASISA_BASE}/providers?${params}`);
  return data?.providerInfo || [];
}

function extractProviderData(p) {
  const addr = p.address || {};
  return {
    name: p.providerName || '',
    address: [addr.addressType || '', addr.addressDescription || '', addr.addressNumber || ''].join(' ').trim(),
    city: addr.cityDescription || '',
    phone: p.contact?.phone || '',
    lat: addr.latitude || '',
    lon: addr.longitude || '',
    doctorType: String(p.doctorType ?? ''),
    providerType: String(p.providerType ?? ''),
    businessGroup: !!p.businessGroup,
    postalCode: addr.postalCode || '',
    collegiateCode: p.professional?.collegiateCode || '',
    parentDescription: p.parentDescription || '',
  };
}

async function main() {
  const provinceCodeFilter = process.env.PROVINCE_CODE || null;
  const allProvincias = JSON.parse(readFileSync(join(__dirname, 'data/provincias.json'), 'utf8'));
  const provincias = provinceCodeFilter
    ? allProvincias.filter((p) => String(p.provinceCode) === String(provinceCodeFilter))
    : allProvincias;

  const especialistasIndex = {};
  const especialistaUrls = [];
  let processed = 0;

  for (const prov of provincias) {
    processed += 1;
    const provSlug = `provincia-de-${toSlug(prov.name)}`;
    console.log(`[${processed}/${provincias.length}] ${prov.name}...`);

    const specialities = await fetchSpecialities(prov.provinceCode);
    if (specialities.length === 0) { console.log('  Sin especialidades'); continue; }

    const especialistas = new Map();

    for (let i = 0; i < specialities.length; i += CONCURRENCY) {
      const batch = specialities.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map((spec) => fetchProvidersPage1(
          prov.provinceCode,
          spec.specialityDescription,
          spec.specialityTypeCode,
        )),
      );

      for (let j = 0; j < batch.length; j += 1) {
        const specName = batch[j].specialityDescription;
        for (const p of results[j]) {
          const name = p.providerName || '';
          if (!name) continue;
          if (String(p.doctorType) !== '1') continue; // skip non-doctors
          const slug = toSlug(name);
          if (!especialistas.has(slug)) {
            especialistas.set(slug, { ...extractProviderData(p), specialities: new Set() });
          }
          especialistas.get(slug).specialities.add(specName);
        }
      }

      if (i + CONCURRENCY < specialities.length) await sleep(500);
    }

    const getLocationSlugs = (city) => {
      const slugs = [provSlug];
      if (city) slugs.push(toSlug(city));
      return slugs;
    };

    let count = 0;
    for (const [espSlug, esp] of especialistas) {
      const locations = getLocationSlugs(esp.city);
      const specs = [...esp.specialities].sort();
      const data = {
        name: esp.name,
        address: esp.address,
        city: esp.city,
        phone: esp.phone,
        lat: esp.lat,
        lon: esp.lon,
        doctorType: esp.doctorType,
        providerType: esp.providerType,
        businessGroup: esp.businessGroup,
        postalCode: esp.postalCode,
        collegiateCode: esp.collegiateCode,
        parentDescription: esp.parentDescription,
        specialities: specs,
      };

      for (const loc of locations) {
        const urlPath = `${loc}/especialistas/${espSlug}`;
        especialistaUrls.push(urlPath);
        especialistasIndex[urlPath] = data;
      }
      count += 1;
    }

    console.log(`  ${specialities.length} especialidades, ${count} especialistas`);
  }

  const urlList = [...new Set(especialistaUrls)].sort();

  if (provinceCodeFilter) {
    const partial = { urls: urlList, index: especialistasIndex };
    writeFileSync(join(__dirname, `data/especialistas-partial-${provinceCodeFilter}.json`), JSON.stringify(partial), 'utf8');
    console.log(`\nParcial provincia ${provinceCodeFilter}: ${urlList.length} URLs, ${Object.keys(especialistasIndex).length} entries`);
  } else {
    writeFileSync(join(__dirname, 'data/valid-especialistas.json'), JSON.stringify(urlList, null, 2), 'utf8');
    writeFileSync(join(__dirname, 'data/especialistas-index.json'), JSON.stringify(especialistasIndex), 'utf8');
    console.log('\nGenerados:');
    console.log(`  valid-especialistas.json: ${urlList.length} URLs`);
    console.log(`  especialistas-index.json: ${Object.keys(especialistasIndex).length} entries`);
  }
}

main().catch((err) => { console.error('Error:', err); process.exit(1); });