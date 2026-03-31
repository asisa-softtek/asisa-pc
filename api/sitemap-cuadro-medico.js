import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const BASE = 'https://main--asisa-pc--asisa-softtek.aem.live';

function toSlug(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function readJsonFile(filename) {
  const filePath = join(process.cwd(), `data/${filename}`);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function buildSitemap(urls) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url>
    <loc>${url}</loc>
  </url>`).join('\n')}
</urlset>`;
}

const EMPTY = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`;

function getProvincias() {
  const provincias = readJsonFile('provincias.json');
  if (!provincias) return EMPTY;
  const urls = provincias.map((p) => `${BASE}/cuadro-medico/salud/provincia-de-${toSlug(p.name)}`);
  return buildSitemap(urls);
}

function getMunicipios() {
  const municipios = readJsonFile('valid-municipios.json');
  if (!municipios) return EMPTY;
  const urls = municipios.map((m) => `${BASE}/cuadro-medico/salud/${toSlug(m)}`);
  return buildSitemap(urls);
}

function getProvinciaSpecs() {
  const combos = readJsonFile('valid-provincia-specs.json');
  if (!combos) return EMPTY;
  const urls = combos.map((c) => `${BASE}/cuadro-medico/salud/${c}`);
  return buildSitemap(urls);
}

function getMunicipioSpecs() {
  const combos = readJsonFile('valid-municipio-specs.json');
  if (!combos) return EMPTY;
  const urls = combos.map((c) => `${BASE}/cuadro-medico/salud/${c}`);
  return buildSitemap(urls);
}

function getGeneralSpecs() {
  const specs = readJsonFile('valid-specialities.json');
  if (!specs) return EMPTY;
  const urls = specs.map((s) => `${BASE}/cuadro-medico/salud/general/${s}`);
  return buildSitemap(urls);
}

function getCentros() {
  const centros = readJsonFile('valid-centros.json');
  if (!centros) return EMPTY;
  const urls = centros.map((c) => `${BASE}/cuadro-medico/salud/${c}`);
  return buildSitemap(urls);
}

function getEspecialistas() {
  const especialistas = readJsonFile('valid-especialistas.json');
  if (!especialistas) return EMPTY;
  const urls = especialistas.map((e) => `${BASE}/cuadro-medico/salud/${e}`);
  return buildSitemap(urls);
}

export default function handler(req, res) {
  const { type } = req.query;

  const generators = {
    provincias: getProvincias,
    municipios: getMunicipios,
    'provincia-specs': getProvinciaSpecs,
    'municipio-specs': getMunicipioSpecs,
    'general-specs': getGeneralSpecs,
    centros: getCentros,
    especialistas: getEspecialistas,
  };

  const gen = generators[type];
  if (!gen) {
    return res.status(400).send('Invalid type parameter');
  }

  res.setHeader('Content-Type', 'text/xml');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400');
  return res.status(200).send(gen());
}
