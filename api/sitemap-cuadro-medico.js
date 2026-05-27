import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const BASE = 'https://www.asisa.es';

function readJson(path) {
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

function buildSitemap(urls) {
  if (!urls.length) return '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>';
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url>\n    <loc>${url}</loc>\n  </url>`).join('\n')}
</urlset>`;
}

// /cuadro-medico/p/{slug}
function getProvincias() {
  const dir = join(process.cwd(), 'data/cuadro-medico/provincias');
  if (!existsSync(dir)) return buildSitemap([]);
  const urls = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => `${BASE}/cuadro-medico/p/${f.replace('.json', '')}`);
  return buildSitemap(urls);
}

// /cuadro-medico/p/{prov}/pe/{spec}
function getProvinciaSpecs() {
  const dir = join(process.cwd(), 'data/cuadro-medico/provincias');
  if (!existsSync(dir)) return buildSitemap([]);
  const urls = [];
  readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .forEach((f) => {
      const provSlug = f.replace('.json', '');
      const data = readJson(join(dir, f));
      (data?.especialidades || []).forEach((specSlug) => {
        urls.push(`${BASE}/cuadro-medico/p/${provSlug}/pe/${specSlug}`);
      });
    });
  return buildSitemap(urls);
}

// /cuadro-medico/d/{name-id}
function getDoctores() {
  const index = readJson(join(process.cwd(), 'data/cuadro-medico/doctores-index.json'));
  if (!index) return buildSitemap([]);
  const urls = Object.keys(index).map((key) => `${BASE}/cuadro-medico/d/${key}`);
  return buildSitemap(urls);
}

// /cuadro-medico/c/{name}
function getCentros() {
  const index = readJson(join(process.cwd(), 'data/cuadro-medico/centros-index.json'));
  if (!index) return buildSitemap([]);
  const urls = Object.keys(index).map((key) => `${BASE}/cuadro-medico/c/${key}`);
  return buildSitemap(urls);
}

// /cuadro-medico/e/{slug}
function getEspecialidades() {
  const dir = join(process.cwd(), 'data/cuadro-medico/especialidades');
  if (!existsSync(dir)) return buildSitemap([]);
  const urls = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => `${BASE}/cuadro-medico/e/${f.replace('.json', '')}`);
  return buildSitemap(urls);
}

const generators = {
  provincias: getProvincias,
  'provincia-specs': getProvinciaSpecs,
  doctores: getDoctores,
  centros: getCentros,
  especialidades: getEspecialidades,
};

export function getCuadroMedicoSitemapXml(type) {
  const gen = generators[type];
  return gen ? gen() : null;
}

export default function handler(req, res) {
  const { type } = req.query;
  const xml = getCuadroMedicoSitemapXml(type);
  if (!xml) return res.status(400).send('type must be: provincias, provincia-specs, doctores, centros, especialidades');

  res.setHeader('Content-Type', 'text/xml');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400');
  return res.status(200).send(xml);
}
