/* eslint-disable no-restricted-syntax, no-await-in-loop, no-continue */
/* eslint-disable no-underscore-dangle, no-console */
/**
 * Script unificado que sustituye generate-localidades.mjs,
 * generate-centros.mjs y generate-especialistas.mjs.
 *
 * Hace UN SOLO pase contra ASISA y genera:
 *  - data/valid-localidades.json
 *  - data/centros-index.json + data/valid-centros.json
 *  - data/especialistas-index.json + data/valid-especialistas.json
 *  - data/providers/{prov}/{spec}.json   (caché de providers por especialidad)
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

function toDisplayName(cityDesc) {
  return cityDesc
    .toLowerCase()
    .replace(/(?:^|\s|\/|-|\()([a-záéíóúüñ])/g, (m, c) => m.slice(0, -1) + c.toUpperCase());
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
    if (pageData?.providerInfo) allProviders = allProviders.concat(pageData.providerInfo);
  }

  return allProviders;
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
    providerLocalicationCode: p.providerLocalicationCode || '',
    documentNumber: p.contact?.documentNumber || '',
  };
}

async function main() {
  const allProvincias = JSON.parse(readFileSync(join(__dirname, 'data/provincias.json'), 'utf8'));
  const provinceFilter = process.env.PROVINCE_CODE || null;
  const provincias = provinceFilter
    ? allProvincias.filter((p) => String(p.provinceCode) === String(provinceFilter))
    : allProvincias;

  const provNameMap = new Map();
  for (const p of allProvincias) provNameMap.set(p.provinceCode, p.name);

  const providersDir = join(__dirname, 'data/providers');
  if (!existsSync(providersDir)) mkdirSync(providersDir, { recursive: true });

  // Acumuladores
  const allCities = new Map();   // "city|provCode" → { cityDescription, provinceCode }
  const centrosIndex = {};
  const centroUrls = [];
  const especialistasIndex = {};
  const especialistaUrls = [];
  const provinciaSpecs = new Set(); // "provincia-de-x/spec-slug"
  const allSpecs = new Set();       // "spec-slug"

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

    const provSlug = toSlug(prov.name);
    const provDir = join(providersDir, provSlug);
    if (!existsSync(provDir)) mkdirSync(provDir, { recursive: true });

    const provSlugFull = `provincia-de-${provSlug}`;

    // Acumuladores por provincia para centros/especialistas
    const centros = new Map();      // nameSlug → { data, specialities }
    const especialistas = new Map();

    // Agrupar specs por slug (deduplicar variantes del mismo nombre)
    const specsBySlug = new Map();
    for (const spec of specs) {
      const slug = toSlug(spec.specialityDescription);
      if (!specsBySlug.has(slug)) specsBySlug.set(slug, []);
      specsBySlug.get(slug).push(spec);
    }

    const providerTasks = [...specsBySlug.entries()].map(([specSlug, slugSpecs]) => async () => {
      const filePath = join(provDir, `${specSlug}.json`);
      let providers;

      if (!FORCE && existsSync(filePath)) {
        providers = JSON.parse(readFileSync(filePath, 'utf8'));
        totalCachedFiles += 1;
      } else {
        // Descargar todas las páginas (deduplicando variantes del mismo slug)
        const allProv = [];
        const seen = new Set();
        for (const spec of slugSpecs) {
          totalApiCalls += 1;
          const fetched = await fetchAllProviders(
            prov.provinceCode,
            spec.specialityDescription,
            spec.specialityTypeCode,
          );
          if (!fetched.length) console.log(`  ✗ ERROR ${prov.name} / ${spec.specialityDescription}`);
          for (const p of fetched) {
            const id = p.providerCode
              || `${p.providerName}|${p.address?.addressDescription}|${p.address?.cityDescription}`;
            if (!seen.has(id)) { seen.add(id); allProv.push(p); }
          }
        }
        providers = allProv;
        writeFileSync(filePath, JSON.stringify(providers), 'utf8');
        totalNewFiles += 1;
      }

      // Extraer ciudades
      for (const p of providers) {
        const city = p.address?.cityDescription;
        if (city) {
          const key = `${city.trim()}|${prov.provinceCode}`;
          if (!allCities.has(key)) allCities.set(key, { cityDescription: city.trim(), provinceCode: prov.provinceCode });
        }
      }

      // Clasificar en centros / especialistas por el nombre real de la especialidad
      // (slugSpecs[0].specialityDescription es el nombre canónico)
      const specName = slugSpecs[0].specialityDescription;
      for (const p of providers) {
        const name = p.providerName || '';
        if (!name) continue;
        const nameSlug = toSlug(name);
        const isDoctor = String(p.doctorType) === '1';
        const bucket = isDoctor ? especialistas : centros;
        if (!bucket.has(nameSlug)) {
          bucket.set(nameSlug, { ...extractProviderData(p), specialities: new Set() });
        }
        bucket.get(nameSlug).specialities.add(specName);
      }

      completed += 1;
      if (completed % 200 === 0 || completed === totalTasks) {
        console.log(`  ${completed}/${totalTasks} (nuevos: ${totalNewFiles}, caché: ${totalCachedFiles})`);
      }
    });

    await parallelLimit(providerTasks, CONCURRENCY);

    // Construir índice centros para esta provincia
    for (const [centroSlug, centro] of centros) {
      const locs = [provSlugFull];
      if (centro.city) locs.push(toSlug(centro.city));
      const specs2 = [...centro.specialities].sort();
      const data = { ...centro, specialities: specs2 };
      delete data.specialities; // se añade explícitamente
      const entry = { ...data, specialities: specs2 };

      for (const loc of locs) {
        const espUrl = `${loc}/especialidades/${centroSlug}`;
        centroUrls.push(espUrl);
        centrosIndex[espUrl] = { ...entry, featuredSpec: '' };

        for (const specN of specs2) {
          const url = `${loc}/${toSlug(specN)}/${centroSlug}`;
          centroUrls.push(url);
          centrosIndex[url] = { ...entry, featuredSpec: specN };
        }
      }
    }

    // Construir índice especialistas para esta provincia
    for (const [espSlug, esp] of especialistas) {
      const locs = [provSlugFull];
      if (esp.city) locs.push(toSlug(esp.city));
      const specs2 = [...esp.specialities].sort();
      const entry = { ...esp, specialities: specs2 };

      for (const loc of locs) {
        const urlPath = `${loc}/especialistas/${espSlug}`;
        especialistaUrls.push(urlPath);
        especialistasIndex[urlPath] = entry;
      }
    }

    // Acumular combos provincia/especialidad
    for (const specSlug of specsBySlug.keys()) {
      provinciaSpecs.add(`${provSlugFull}/${specSlug}`);
      allSpecs.add(specSlug);
    }

    console.log(`  [${prov.name}] ${specs.length} especialidades, ${centros.size} centros, ${especialistas.size} especialistas`);
  }

  // Paso 3: escribir outputs (solo si no es ejecución parcial por provincia)
  if (!provinceFilter) {
    // valid-localidades.json
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

    const slugCount = new Map();
    for (const loc of localidades) slugCount.set(loc.slug, (slugCount.get(loc.slug) || 0) + 1);
    const duplicates = [...slugCount.entries()].filter(([, c]) => c > 1);
    if (duplicates.length > 0) {
      console.log(`\n⚠ ${duplicates.length} slugs duplicados:`);
      for (const [slug, count] of duplicates.slice(0, 10)) {
        const entries = localidades.filter((l) => l.slug === slug);
        console.log(`  "${slug}" (${count}): ${entries.map((e) => `${e.cityDescription} [${e.provincia}]`).join(', ')}`);
      }
    }

    writeFileSync(join(__dirname, 'data/valid-localidades.json'), JSON.stringify(localidades, null, 2), 'utf8');

    // centros
    const centroUrlList = [...new Set(centroUrls)].sort();
    writeFileSync(join(__dirname, 'data/valid-centros.json'), JSON.stringify(centroUrlList, null, 2), 'utf8');
    writeFileSync(join(__dirname, 'data/centros-index.json'), JSON.stringify(centrosIndex), 'utf8');

    // especialistas
    const espUrlList = [...new Set(especialistaUrls)].sort();
    writeFileSync(join(__dirname, 'data/valid-especialistas.json'), JSON.stringify(espUrlList, null, 2), 'utf8');
    writeFileSync(join(__dirname, 'data/especialistas-index.json'), JSON.stringify(especialistasIndex), 'utf8');

    // speciality combos (antes en generate-specialities.mjs)
    const provSpecList = [...provinciaSpecs].sort();
    const specList = [...allSpecs].sort();
    const municipioSpecs = new Set();
    for (const loc of localidades) {
      const prov = allProvincias.find((p) => p.provinceCode === loc.provinceCode);
      if (!prov) continue;
      const provSlugFull = `provincia-de-${toSlug(prov.name)}`;
      for (const combo of provinciaSpecs) {
        if (combo.startsWith(`${provSlugFull}/`)) {
          municipioSpecs.add(`${loc.slug}/${combo.slice(provSlugFull.length + 1)}`);
        }
      }
    }
    const muniSpecList = [...municipioSpecs].sort();
    writeFileSync(join(__dirname, 'data/valid-provincia-specs.json'), JSON.stringify(provSpecList, null, 2), 'utf8');
    writeFileSync(join(__dirname, 'data/valid-municipio-specs.json'), JSON.stringify(muniSpecList, null, 2), 'utf8');
    writeFileSync(join(__dirname, 'data/valid-specialities.json'), JSON.stringify(specList, null, 2), 'utf8');

    console.log('\n--- Generados ---');
    console.log(`  valid-localidades.json:       ${localidades.length} localidades`);
    console.log(`  valid-centros.json:           ${centroUrlList.length} URLs`);
    console.log(`  centros-index.json:           ${Object.keys(centrosIndex).length} entries`);
    console.log(`  valid-especialistas.json:     ${espUrlList.length} URLs`);
    console.log(`  especialistas-index.json:     ${Object.keys(especialistasIndex).length} entries`);
    console.log(`  valid-provincia-specs.json:   ${provSpecList.length} combos`);
    console.log(`  valid-municipio-specs.json:   ${muniSpecList.length} combos`);
    console.log(`  valid-specialities.json:      ${specList.length} especialidades`);
  } else {
    console.log(`\nEjecución parcial (provincia ${provinceFilter}) - no se escriben JSONs finales`);
  }

  console.log('\n--- Peticiones ASISA ---');
  console.log(`  Total:   ${totalApiCalls}`);
  console.log(`  Nuevos:  ${totalNewFiles} ficheros`);
  console.log(`  Caché:   ${totalCachedFiles} ficheros`);
}

main().catch((err) => { console.error('Error:', err); process.exit(1); });
