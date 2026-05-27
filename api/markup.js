/* eslint-disable no-console */
/**
 * BYOM overlay markup endpoint for EDS — also viewable directly in the
 * browser because it includes the EDS scripts/CSS inline.
 *
 *   /markup/cuadro-medico/p/<slug>           → provincia template
 *   /markup/cuadro-medico/p/<prov>/pe/<spec> → provincia + especialidad template
 *   /markup/cuadro-medico/d/<key>            → ficha doctor template
 *   /markup/cuadro-medico/c/<key>            → ficha centro template
 *   /markup/cuadro-medico/e/<slug>           → especialidad template
 *   /markup/sitemap.xml                      → sitemap index (Vercel-generated)
 *   /markup/sitemap-cuadro-medico-*.xml      → per-type sitemap
 *   /markup/<other>                          → 404 (overlay-pass)
 */

import { getSitemapIndexXml } from './sitemap.js';
import { getCuadroMedicoSitemapXml } from './sitemap-cuadro-medico.js';

const PROVINCIA_BLOCKS = `<div class="cuadro-medico"><div><div></div></div></div>
<div class="cuadro-medico-otras-especialidades"><div><div></div></div></div>
<div class="cuadro-medico-otras-provincias"><div><div></div></div></div>`;

const DOCTOR_BLOCKS = `<div class="cuadro-medico-ficha-doctor"><div><div></div></div></div>
<div class="cuadro-medico-otros-medicos"><div><div></div></div></div>`;

const CENTRO_BLOCKS = '<div class="cuadro-medico-ficha-centro"><div><div></div></div></div>';

const ESPECIALIDAD_BLOCKS = `<div class="cuadro-medico"><div><div></div></div></div>
<div class="cuadro-medico-otras-especialidades"><div><div></div></div></div>
<div class="cuadro-medico-otras-provincias"><div><div></div></div></div>`;

function buildPage(path, blocks, title) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<script>
  // Strip the /markup prefix so the block JS sees the real cuadro-medico path.
  try { history.replaceState({}, '', ${JSON.stringify(path)}); } catch (e) {}
</script>
<link rel="stylesheet" href="/styles/styles.css">
<link rel="stylesheet" href="/styles/fonts.css">
<link rel="stylesheet" href="https://asisa-pc.vercel.app/etc.clientlibs/wasisa/clientlibs/clientlib-generic.min.css?v=1.0">
<link rel="stylesheet" href="https://asisa-pc.vercel.app/etc.clientlibs/wasisa/clientlibs/clientlib-iconslib.min.css?v=1.0">
<script src="/scripts/aem.js" type="module"></script>
<script src="/scripts/scripts.js" type="module"></script>
</head>
<body>
<header></header>
<main>
<div>
${blocks}
</div>
</main>
<footer></footer>
</body>
</html>`;
}

function sendHtml(res, html, source) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.setHeader('x-source', source);
  res.status(200).send(html);
}

function sendXml(res, xml, source) {
  res.setHeader('Content-Type', 'text/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.setHeader('x-source', source);
  res.status(200).send(xml);
}

function send404(res, path) {
  res.setHeader('x-source', 'overlay-pass');
  res.status(404).send(`no overlay for ${path}`);
}

function extractPath(req) {
  let p = req.query?.path || '';
  if (typeof p !== 'string') p = String(p);
  while (p.startsWith('/')) p = p.slice(1);
  if (p.endsWith('.plain.html')) p = p.slice(0, -'.plain.html'.length);
  else if (p.endsWith('.html')) p = p.slice(0, -'.html'.length);
  return `/${p}`;
}

function isProvinciaPath(path) {
  return /^\/cuadro-medico\/p\/.+$/.test(path);
}

function isDoctorPath(path) {
  return /^\/cuadro-medico\/d\/.+$/.test(path);
}

function isCentroPath(path) {
  return /^\/cuadro-medico\/c\/.+$/.test(path);
}

function isEspecialidadPath(path) {
  return /^\/cuadro-medico\/e\/.+$/.test(path);
}

const SITEMAP_INDEX_PATH = '/sitemap.xml';
const SITEMAP_TYPE_RE = /^\/sitemap-cuadro-medico-(provincias|provincia-specs|doctores|centros|especialidades)\.xml$/;

export default function handler(req, res) {
  const path = extractPath(req);

  if (isProvinciaPath(path)) {
    return sendHtml(res, buildPage(path, PROVINCIA_BLOCKS, 'Cuadro Médico - Provincia'), 'template:provincia');
  }
  if (isDoctorPath(path)) {
    return sendHtml(res, buildPage(path, DOCTOR_BLOCKS, 'Ficha de Médico'), 'template:doctor');
  }
  if (isCentroPath(path)) {
    return sendHtml(res, buildPage(path, CENTRO_BLOCKS, 'Ficha de Centro Médico'), 'template:centro');
  }
  if (isEspecialidadPath(path)) {
    return sendHtml(res, buildPage(path, ESPECIALIDAD_BLOCKS, 'Cuadro Médico - Especialidad'), 'template:especialidad');
  }
  if (path === SITEMAP_INDEX_PATH) {
    return sendXml(res, getSitemapIndexXml(), 'sitemap:index');
  }
  const sitemapMatch = path.match(SITEMAP_TYPE_RE);
  if (sitemapMatch) {
    const xml = getCuadroMedicoSitemapXml(sitemapMatch[1]);
    if (xml) return sendXml(res, xml, `sitemap:${sitemapMatch[1]}`);
  }

  return send404(res, path);
}
