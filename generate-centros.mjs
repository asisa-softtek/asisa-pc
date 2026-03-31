/* eslint-disable no-restricted-syntax, no-await-in-loop, no-continue */
/* eslint-disable no-underscore-dangle, no-console */
/**
 * Genera datos de centros médicos (doctorType !== 1):
 *  - data/valid-centros.json    (URLs)
 *  - data/centros-index.json    (info + especialidades por centro)
 *
 * Recorre TODAS las especialidades (page 1) por provincia.
 * Genera URLs para provincia Y municipio.
 *
 * Uso: node generate-centros.mjs
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
  const municipios = JSON.parse(readFileSync(join(__dirname, 'data/municipios.json'), 'utf8'));

  const muniMap = new Map();
  for (const m of municipios) {
    muniMap.set(`${normalize(m.municipio)}|${m.provinceCode}`, m.municipio);
  }

  const centrosIndex = {};
  const centroUrls = [];
  let processed = 0;

  for (const prov of provincias) {
    processed += 1;
    const provSlug = `provincia-de-${toSlug(prov.name)}`;
    console.log(`[${processed}/${provincias.length}] ${prov.name}...`);

    const specialities = await fetchSpecialities(prov.provinceCode);
    if (specialities.length === 0) { console.log('  Sin especialidades'); continue; }

    const centros = new Map();

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
          if (String(p.doctorType) === '1') continue; // skip doctors
          const slug = toSlug(name);
          if (!centros.has(slug)) {
            centros.set(slug, { ...extractProviderData(p), specialities: new Set() });
          }
          centros.get(slug).specialities.add(specName);
        }
      }

      if (i + CONCURRENCY < specialities.length) await sleep(500);
    }

    const getLocationSlugs = (city) => {
      const slugs = [provSlug];
      const key = `${normalize(city)}|${prov.provinceCode}`;
      if (muniMap.has(key)) slugs.push(toSlug(muniMap.get(key)));
      return slugs;
    };

    let count = 0;
    for (const [centroSlug, centro] of centros) {
      const locations = getLocationSlugs(centro.city);
      const specs = [...centro.specialities].sort();
      const data = {
        name: centro.name,
        address: centro.address,
        city: centro.city,
        phone: centro.phone,
        lat: centro.lat,
        lon: centro.lon,
        doctorType: centro.doctorType,
        providerType: centro.providerType,
        businessGroup: centro.businessGroup,
        postalCode: centro.postalCode,
        collegiateCode: centro.collegiateCode,
        parentDescription: centro.parentDescription,
        specialities: specs,
      };

      for (const loc of locations) {
        // Template 05: /{localidad}/especialidades/{centro}
        const espUrl = `${loc}/especialidades/${centroSlug}`;
        centroUrls.push(espUrl);
        centrosIndex[espUrl] = { ...data, featuredSpec: '' };

        // Template 04: /{localidad}/{especialidad}/{centro}
        for (const specName of specs) {
          const url = `${loc}/${toSlug(specName)}/${centroSlug}`;
          centroUrls.push(url);
          centrosIndex[url] = { ...data, featuredSpec: specName };
        }
      }
      count += 1;
    }

    console.log(`  ${specialities.length} especialidades, ${count} centros`);
  }

  const urlList = [...new Set(centroUrls)].sort();

  if (provinceCodeFilter) {
    const partial = { urls: urlList, index: centrosIndex };
    writeFileSync(join(__dirname, `data/centros-partial-${provinceCodeFilter}.json`), JSON.stringify(partial), 'utf8');
    console.log(`\nParcial provincia ${provinceCodeFilter}: ${urlList.length} URLs, ${Object.keys(centrosIndex).length} entries`);
  } else {
    writeFileSync(join(__dirname, 'data/valid-centros.json'), JSON.stringify(urlList, null, 2), 'utf8');
    writeFileSync(join(__dirname, 'data/centros-index.json'), JSON.stringify(centrosIndex), 'utf8');
    console.log('\nGenerados:');
    console.log(`  valid-centros.json: ${urlList.length} URLs`);
    console.log(`  centros-index.json: ${Object.keys(centrosIndex).length} entries`);
  }
}

main().catch((err) => { console.error('Error:', err); process.exit(1); });
