/* eslint-disable no-console */
/**
 * Genera HTML compatible con EDS para las páginas del cuadro médico.
 *
 * URLs soportadas:
 *  /cuadro-medico/provincia-de-zamora  → toda la provincia
 *  /cuadro-medico/zamora               → solo municipio (filtra por cityDescription)
 *
 * Estructura de filas del bloque cuadro-medico:
 *  0: [locationName, provinceCode, totalProviders]
 *  1-N: [providerName, speciality, address, city, phone, lat, lon]
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export const config = { maxDuration: 60 };

const ASISA_API_KEY = '0908b85b9d0e4a75b2eb33048bd9fe01';
const ASISA_BASE = 'https://ursaepre.asisa.es/ASISA/middlewasisa/public/v1/api/searchPortal';
const CONCURRENCY = 5;

const PROVINCIAS = [
  { name: 'ÁLAVA', code: '1' }, { name: 'ALBACETE', code: '2' },
  { name: 'ALICANTE', code: '3' }, { name: 'ALMERÍA', code: '4' },
  { name: 'ÁVILA', code: '5' }, { name: 'BADAJOZ', code: '6' },
  { name: 'BALEARES', code: '7' }, { name: 'BARCELONA', code: '8' },
  { name: 'BURGOS', code: '9' }, { name: 'CÁCERES', code: '10' },
  { name: 'CÁDIZ', code: '11' }, { name: 'CASTELLÓN', code: '12' },
  { name: 'CIUDAD REAL', code: '13' }, { name: 'CÓRDOBA', code: '14' },
  { name: 'LA CORUÑA', code: '15' }, { name: 'CUENCA', code: '16' },
  { name: 'GERONA', code: '17' }, { name: 'GRANADA', code: '18' },
  { name: 'GUADALAJARA', code: '19' }, { name: 'GUIPÚZCOA', code: '20' },
  { name: 'HUELVA', code: '21' }, { name: 'HUESCA', code: '22' },
  { name: 'JAÉN', code: '23' }, { name: 'LEÓN', code: '24' },
  { name: 'LÉRIDA', code: '25' }, { name: 'LA RIOJA', code: '26' },
  { name: 'LUGO', code: '27' }, { name: 'MADRID', code: '28' },
  { name: 'MÁLAGA', code: '29' }, { name: 'MURCIA', code: '30' },
  { name: 'NAVARRA', code: '31' }, { name: 'ORENSE', code: '32' },
  { name: 'PALENCIA', code: '34' }, { name: 'LAS PALMAS', code: '35' },
  { name: 'PONTEVEDRA', code: '36' }, { name: 'SALAMANCA', code: '37' },
  { name: 'TENERIFE', code: '38' }, { name: 'CANTABRIA', code: '39' },
  { name: 'SEGOVIA', code: '40' }, { name: 'SEVILLA', code: '41' },
  { name: 'SORIA', code: '42' }, { name: 'TARRAGONA', code: '43' },
  { name: 'TERUEL', code: '44' }, { name: 'TOLEDO', code: '45' },
  { name: 'VALENCIA', code: '46' }, { name: 'VALLADOLID', code: '47' },
  { name: 'VIZCAYA', code: '48' }, { name: 'ZAMORA', code: '49' },
  { name: 'ZARAGOZA', code: '50' }, { name: 'CEUTA', code: '51' },
  { name: 'MELILLA', code: '52' }, { name: 'ASTURIAS', code: '57' },
];

// Lazy-load localidades (generadas desde ASISA)
let localidadesCache = null;
function getLocalidades() {
  if (!localidadesCache) {
    localidadesCache = JSON.parse(readFileSync(join(process.cwd(), 'data/valid-localidades.json'), 'utf8'));
  }
  return localidadesCache;
}

function normalize(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function toSlug(str) {
  return normalize(str).replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function getProvinceSlug(code) {
  const prov = PROVINCIAS.find((p) => p.code === code);
  return prov ? toSlug(prov.name) : null;
}

function loadPreloadedProviders(provinceCode, specSlug) {
  try {
    const provSlug = getProvinceSlug(provinceCode);
    if (!provSlug) return null;
    const filePath = join(process.cwd(), `data/providers/${provSlug}/${specSlug}.json`);
    if (!existsSync(filePath)) return null;
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function findProvincia(slug) {
  const cleaned = slug
    .replace(/^provincia-de-/, '')
    .replace(/-/g, ' ')
    .trim();
  return PROVINCIAS.find((p) => normalize(p.name) === normalize(cleaned));
}

function findLocalidad(slug) {
  const localidades = getLocalidades();
  return localidades.find((l) => l.slug === slug);
}

/**
 * Resuelve el slug a { locationName, provinceCode, cityFilter }
 *  - provincia-de-X → provincia completa (cityFilter = null)
 *  - X              → localidad ASISA (cityFilter = cityDescription normalizado)
 */
function resolveLocation(slug) {
  const cleanSlug = slug.replace('.html', '').replace('.plain', '');

  // 1. Intentar como provincia
  if (cleanSlug.startsWith('provincia-de-')) {
    const prov = findProvincia(cleanSlug);
    if (prov) return { locationName: prov.name, provinceCode: prov.code, cityFilter: null };
  }

  // 2. Intentar como localidad ASISA
  const loc = findLocalidad(cleanSlug);
  if (loc) {
    return {
      locationName: loc.displayName,
      provinceCode: loc.provinceCode,
      cityFilter: normalize(loc.cityDescription),
    };
  }

  return null;
}

function asisaFetch(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  return fetch(url, {
    signal: controller.signal,
    headers: {
      'Ocp-Apim-Subscription-Key': ASISA_API_KEY,
      'Api-Version': '1',
    },
  }).then((resp) => {
    clearTimeout(timeout);
    if (!resp.ok) return null;
    return resp.json();
  }).catch(() => {
    clearTimeout(timeout);
    return null;
  });
}

async function fetchSpecialities(provinceCode) {
  const url = `${ASISA_BASE}/autocomplete/specialities?specialityDescription=&networkCode=1&provinceCode=${provinceCode}&maxResultsNumber=200`;
  return (await asisaFetch(url)) || [];
}

async function fetchAllProvidersForSpec(provinceCode, specDesc, specType) {
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
    // eslint-disable-next-line no-await-in-loop
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
      // eslint-disable-next-line no-await-in-loop
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function buildProviderRow(p, fallbackSpec) {
  const addr = p.address || {};
  const fullAddr = `${addr.addressType || ''} ${addr.addressDescription || ''} ${addr.addressNumber || ''}`.trim();
  const spec = p.specialityInfo?.specialityDescription || fallbackSpec;
  const doctorType = p.doctorType ?? '';
  const providerType = p.providerType ?? '';
  const businessGroup = p.businessGroup ? '1' : '0';
  const collegiateCode = p.professional?.collegiateCode || '';
  const parentDesc = p.parentDescription || '';
  const postalCode = addr.postalCode || '';
  const ePrescription = p.electronicPrescription ? '1' : '0';
  const onlineAppt = p.onlineAppointment ? '1' : '0';
  const langs = (p.languages || []).map((l) => l.languageDescription || '').filter(Boolean).join(',');
  return `    <div><div>${p.providerName || ''}</div><div>${spec}</div><div>${fullAddr}</div><div>${addr.cityDescription || ''}</div><div>${p.contact?.phone || ''}</div><div>${addr.latitude || ''}</div><div>${addr.longitude || ''}</div><div>${doctorType}</div><div>${providerType}</div><div>${businessGroup}</div><div>${collegiateCode}</div><div>${parentDesc}</div><div>${postalCode}</div><div>${ePrescription}</div><div>${onlineAppt}</div><div>${langs}</div></div>`;
}

// Top provinces for "general" pages (fetches from these to stay within timeout)
const TOP_PROVINCES = ['28', '8', '46', '41', '29', '3', '30', '7', '11', '35'];

async function handleGeneralSpec(req, res, specSlug) {
  if (!specSlug) {
    return res.status(404).send(`<!DOCTYPE html>
<html lang="es"><head><title>No encontrado</title></head>
<body><header></header><main><div><h1>Especialidad no especificada</h1></div></main><footer></footer></body></html>`);
  }

  try {
    // Find the speciality from a major province (Madrid)
    const allSpecs = await fetchSpecialities('28');
    const normalizedSlug = normalize(specSlug.replace(/-/g, ' '));
    const match = allSpecs.find((s) => normalize(s.specialityDescription) === normalizedSlug);

    if (!match) {
      return res.status(404).send(`<!DOCTYPE html>
<html lang="es"><head><title>No encontrado</title></head>
<body><header></header><main><div><h1>Especialidad no encontrada</h1></div></main><footer></footer></body></html>`);
    }

    const specName = match.specialityDescription;

    // Fetch providers from top provinces in parallel
    const tasks = TOP_PROVINCES.map((code) => () => fetchAllProvidersForSpec(
      code,
      specName,
      match.specialityTypeCode,
    ));
    const providersByProv = await parallelLimit(tasks, CONCURRENCY);

    const allRows = [];
    const normalizedSpecName = normalize(specName);
    for (let i = 0; i < TOP_PROVINCES.length; i += 1) {
      const providers = providersByProv[i] || [];
      // eslint-disable-next-line no-restricted-syntax
      for (const p of providers) {
        // Filter: only exact speciality match (ASISA may return partial matches)
        const provSpec = p.specialityInfo?.specialityDescription || '';
        // eslint-disable-next-line no-continue
        if (provSpec && normalize(provSpec) !== normalizedSpecName) continue;
        allRows.push(buildProviderRow(p, specName));
      }
    }

    const totalProviders = allRows.length;

    const mainContent = `<div>
  <h1>${specName} – Cuadro Médico ASISA</h1>
  <div class="cuadro-medico">
    <div><div>${specName}</div><div>general</div><div>${totalProviders}</div></div>
${allRows.join('\n')}
  </div>
  <div class="cuadro-medico-top-especialidades"></div>
  <div class="cuadro-medico-localidades">
    <div><div>${specSlug}</div><div>${specName}</div></div>
  </div>
  <div class="cuadro-medico-provincias"></div>
</div>`;

    const finalHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${specName} – Cuadro Médico ASISA</title>
  <link rel="stylesheet" href="/styles/styles.css">
  <link rel="stylesheet" href="/blocks/cuadro-medico/cuadro-medico.css">
  <link rel="stylesheet" href="/blocks/cuadro-medico-top-especialidades/cuadro-medico-top-especialidades.css">
  <link rel="stylesheet" href="/blocks/cuadro-medico-localidades/cuadro-medico-localidades.css">
  <link rel="stylesheet" href="/blocks/cuadro-medico-provincias/cuadro-medico-provincias.css">
</head>
<body>
  <header></header>
  <main>
    ${mainContent}
  </main>
  <footer></footer>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).send(finalHtml.trim());
  } catch (error) {
    console.error('General Spec Error:', error);
    return res.status(500).send(`<div>Error interno: ${error.message}</div>`);
  }
}

// Lazy-load centros index
let centrosCache = null;
function getCentrosIndex() {
  if (!centrosCache) {
    try {
      centrosCache = JSON.parse(readFileSync(join(process.cwd(), 'data/centros-index.json'), 'utf8'));
    } catch {
      centrosCache = {};
    }
  }
  return centrosCache;
}

// Lazy-load especialistas index
let especialistasCache = null;
function getEspecialistasIndex() {
  if (!especialistasCache) {
    try {
      especialistasCache = JSON.parse(readFileSync(join(process.cwd(), 'data/especialistas-index.json'), 'utf8'));
    } catch {
      especialistasCache = {};
    }
  }
  return especialistasCache;
}

function buildStaticProviderRow(entry, specName) {
  return buildProviderRow({
    providerName: entry.name,
    specialityInfo: { specialityDescription: specName },
    address: {
      addressType: '',
      addressDescription: entry.address,
      addressNumber: '',
      cityDescription: entry.city,
      postalCode: entry.postalCode,
      latitude: entry.lat,
      longitude: entry.lon,
    },
    contact: { phone: entry.phone },
    doctorType: entry.doctorType,
    providerType: entry.providerType,
    businessGroup: entry.businessGroup,
    professional: { collegiateCode: entry.collegiateCode },
    parentDescription: entry.parentDescription,
    electronicPrescription: false,
    onlineAppointment: false,
    languages: [],
  }, specName);
}

function loadProviderDetails(locCode) {
  if (!locCode) return null;
  try {
    const filePath = join(process.cwd(), `data/provider-details/${locCode}.json`);
    if (!existsSync(filePath)) return null;
    const raw = readFileSync(filePath, 'utf8');
    return JSON.parse(raw); // array de entries, una por especialidad
  } catch {
    return null;
  }
}

// Template 04 + 05: /cuadro-medico/salud/{localidad}/{especialidad}/{centro}
//                   /cuadro-medico/salud/{localidad}/especialidades/{centro}
function handleCentro(res, locationSlug, specSlug, centroSlug) {
  const centros = getCentrosIndex();
  const key = `${locationSlug}/${specSlug}/${centroSlug}`;
  const centro = centros[key];

  if (!centro) {
    return res.status(404).send(`<!DOCTYPE html>
<html lang="es"><head><title>No encontrado</title></head>
<body><header></header><main><div><h1>Centro no encontrado</h1></div></main><footer></footer></body></html>`);
  }

  // Cargar detalle completo desde provider-details si está disponible
  const details = loadProviderDetails(centro.providerLocalicationCode);
  const allSpecialities = details
    ? [...new Set(details.map((d) => d.specialityInfo?.specialityDescription).filter(Boolean))].sort()
    : centro.specialities;

  const featuredSpec = centro.featuredSpec || allSpecialities[0] || '';
  const cardRow = buildStaticProviderRow(centro, featuredSpec);
  const specSuffix = featuredSpec ? ` – ${featuredSpec}` : '';

  const mainContent = `<div>
  <h1>${centro.name}${specSuffix}</h1>
  <div class="cuadro-medico">
    <div><div>${centro.name}</div><div>${locationSlug}</div><div>1</div></div>
${cardRow}
  </div>
  <div class="cuadro-medico-centro-specs">
    <div><div>${allSpecialities.join('|')}</div><div>${locationSlug}</div></div>
  </div>
  <div class="cuadro-medico-top-especialidades"></div>
  <div class="cuadro-medico-provincias"></div>
</div>`;

  const finalHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${centro.name}${specSuffix} | Cuadro Médico ASISA</title>
  <link rel="stylesheet" href="/styles/styles.css">
  <link rel="stylesheet" href="/blocks/cuadro-medico/cuadro-medico.css">
  <link rel="stylesheet" href="/blocks/cuadro-medico-centro-specs/cuadro-medico-centro-specs.css">
  <link rel="stylesheet" href="/blocks/cuadro-medico-top-especialidades/cuadro-medico-top-especialidades.css">
  <link rel="stylesheet" href="/blocks/cuadro-medico-provincias/cuadro-medico-provincias.css">
</head>
<body>
  <header></header>
  <main>
    ${mainContent}
  </main>
  <footer></footer>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(200).send(finalHtml.trim());
}

// Template 06: /cuadro-medico/salud/{localidad}/especialistas/{profesional}
function handleEspecialista(res, locationSlug, espSlug) {
  const especialistas = getEspecialistasIndex();
  const key = `${locationSlug}/especialistas/${espSlug}`;
  const esp = especialistas[key];

  if (!esp) {
    return res.status(404).send(`<!DOCTYPE html>
<html lang="es"><head><title>No encontrado</title></head>
<body><header></header><main><div><h1>Especialista no encontrado</h1></div></main><footer></footer></body></html>`);
  }

  // Cargar detalle completo desde provider-details si está disponible
  const details = loadProviderDetails(esp.providerLocalicationCode);
  const allSpecialities = details
    ? [...new Set(details.map((d) => d.specialityInfo?.specialityDescription).filter(Boolean))].sort()
    : esp.specialities;

  const mainSpec = allSpecialities[0] || '';
  const cardRow = buildStaticProviderRow(esp, mainSpec);

  const mainContent = `<div>
  <h1>${esp.name}</h1>
  <div class="cuadro-medico">
    <div><div>${esp.name}</div><div>${locationSlug}</div><div>1</div></div>
${cardRow}
  </div>
  <div class="cuadro-medico-centro-specs">
    <div><div>${allSpecialities.join('|')}</div><div>${locationSlug}</div></div>
  </div>
  <div class="cuadro-medico-top-especialidades"></div>
  <div class="cuadro-medico-provincias"></div>
</div>`;

  const finalHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${esp.name} | Cuadro Médico ASISA</title>
  <link rel="stylesheet" href="/styles/styles.css">
  <link rel="stylesheet" href="/blocks/cuadro-medico/cuadro-medico.css">
  <link rel="stylesheet" href="/blocks/cuadro-medico-centro-specs/cuadro-medico-centro-specs.css">
  <link rel="stylesheet" href="/blocks/cuadro-medico-top-especialidades/cuadro-medico-top-especialidades.css">
  <link rel="stylesheet" href="/blocks/cuadro-medico-provincias/cuadro-medico-provincias.css">
</head>
<body>
  <header></header>
  <main>
    ${mainContent}
  </main>
  <footer></footer>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(200).send(finalHtml.trim());
}

export default async function handler(req, res) {
  const parts = (req.query.slug || '')
    .split('/')
    .filter((p) => p && p !== 'salud');

  // If no slug from query, parse from URL path
  if (parts.length === 0) {
    const urlParts = req.url.split('?')[0].split('/').filter((p) => p && p !== 'api' && p !== 'cuadro-medico' && p !== 'salud');
    parts.push(...urlParts);
  }

  if (parts.length === 0) {
    return res.status(200).send(`<!DOCTYPE html>
<html lang="es"><head><title>Cuadro Médico | ASISA</title></head>
<body><header></header><main><div><h1>Cuadro Médico</h1><p>Selecciona una provincia</p></div></main><footer></footer></body></html>`);
  }

  const locationSlug = parts[0];
  const isGeneral = locationSlug === 'general';

  // Template 03: /cuadro-medico/salud/general/{especialidad}
  if (isGeneral) {
    return handleGeneralSpec(req, res, parts[1] || null);
  }

  // Template 06: /cuadro-medico/salud/{localidad}/especialistas/{profesional}
  if (parts[1] === 'especialistas' && parts[2]) {
    return handleEspecialista(res, locationSlug, parts[2]);
  }

  // Template 05: /cuadro-medico/salud/{localidad}/especialidades/{centro}
  if (parts[1] === 'especialidades' && parts[2]) {
    return handleCentro(res, locationSlug, 'especialidades', parts[2]);
  }

  // Template 04: /cuadro-medico/salud/{localidad}/{especialidad}/{centro}
  if (parts[1] && parts[2]) {
    return handleCentro(res, locationSlug, parts[1], parts[2]);
  }

  const specSlug = parts[1] || null;

  const location = resolveLocation(locationSlug);
  if (!location) {
    return res.status(404).send(`<!DOCTYPE html>
<html lang="es"><head><title>No encontrado</title></head>
<body><header></header><main><div><h1>Ubicación no encontrada</h1></div></main><footer></footer></body></html>`);
  }

  const { locationName, provinceCode, cityFilter } = location;

  try {
    // 1. Fetch specialities
    const allSpecialities = await fetchSpecialities(provinceCode);

    // 2. If a speciality slug is provided, find the matching one
    let specialities;
    let specFilterName = null;

    if (specSlug) {
      const normalizedSlug = normalize(specSlug.replace(/-/g, ' '));
      const match = allSpecialities
        .find((s) => normalize(s.specialityDescription) === normalizedSlug);
      if (!match) {
        return res.status(404).send(`<!DOCTYPE html>
<html lang="es"><head><title>No encontrado</title></head>
<body><header></header><main><div><h1>Especialidad no encontrada</h1></div></main><footer></footer></body></html>`);
      }
      specialities = [match];
      specFilterName = match.specialityDescription;
    } else {
      specialities = allSpecialities;
    }

    // 3. Fetch providers (from pre-generated files if available, else live)
    const tasks = specialities.map((spec) => () => {
      const specSlug = toSlug(spec.specialityDescription);
      const cached = loadPreloadedProviders(provinceCode, specSlug);
      if (cached) return Promise.resolve(cached);
      return fetchAllProvidersForSpec(provinceCode, spec.specialityDescription, spec.specialityTypeCode);
    });
    const providersBySpec = await parallelLimit(tasks, CONCURRENCY);

    // 4. Build rows, filtering by city and exact speciality match
    const allRows = [];
    for (let i = 0; i < specialities.length; i += 1) {
      const providers = providersBySpec[i] || [];
      const expectedSpec = normalize(specialities[i].specialityDescription);
      // eslint-disable-next-line no-restricted-syntax
      for (const p of providers) {
        if (cityFilter) {
          const city = normalize(p.address?.cityDescription || '');
          // eslint-disable-next-line no-continue
          if (city !== cityFilter) continue;
        }
        // Filter: only exact speciality match (ASISA may return partial matches)
        const provSpec = p.specialityInfo?.specialityDescription || '';
        // eslint-disable-next-line no-continue
        if (specFilterName && provSpec && normalize(provSpec) !== expectedSpec) continue;
        allRows.push(buildProviderRow(p, specialities[i].specialityDescription));
      }
    }

    const totalProviders = allRows.length;
    const titlePrefix = cityFilter ? '' : 'Provincia de ';
    const specTitle = specFilterName ? ` - ${specFilterName}` : '';

    if (totalProviders === 0) {
      return res.status(404).send(`<!DOCTYPE html>
<html lang="es"><head><title>No encontrado</title></head>
<body><header></header><main><div><h1>No se encontraron proveedores en ${titlePrefix}${locationName}${specTitle}</h1></div></main><footer></footer></body></html>`);
    }

    const mainContent = `<div>
  <h1>Cuadro Médico en ${titlePrefix}${locationName}${specTitle}</h1>
  <div class="cuadro-medico">
    <div><div>${locationName}</div><div>${provinceCode}</div><div>${totalProviders}</div></div>
${allRows.join('\n')}
  </div>
  <div class="cuadro-medico-especialidades">
    <div><div>${provinceCode}</div><div>${locationSlug}</div><div>${locationName}</div></div>
  </div>
  <div class="cuadro-medico-provincias"></div>
</div>`;

    const finalHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Cuadro Médico en ${titlePrefix}${locationName}${specTitle} | ASISA</title>
  <link rel="stylesheet" href="/styles/styles.css">
  <link rel="stylesheet" href="/blocks/cuadro-medico/cuadro-medico.css">
  <link rel="stylesheet" href="/blocks/cuadro-medico-especialidades/cuadro-medico-especialidades.css">
  <link rel="stylesheet" href="/blocks/cuadro-medico-provincias/cuadro-medico-provincias.css">
</head>
<body>
  <header></header>
  <main>
    ${mainContent}
  </main>
  <footer></footer>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');

    return res.status(200).send(finalHtml.trim());
  } catch (error) {
    console.error('Cuadro Medico Error:', error);
    return res.status(500).send(`<div>Error interno: ${error.message}</div>`);
  }
}
