/* eslint-disable no-console */
/**
 * Unified BYOM markup endpoint for EDS.
 *
 * fstab `/` is mounted at https://asisa-pc.vercel.app/markup with no suffix.
 * EDS fetches `{base}{contentPath}` for any page.
 *
 * Behaviour:
 *   - /cuadro-medico/p/<slug>       → provincia template HTML
 *   - /cuadro-medico/p/<prov>/pe/.. → provincia template HTML
 *   - /cuadro-medico/d/<slug>       → doctor template HTML
 *   - /cuadro-medico/e/<slug>       → especialidad template HTML
 *   - any other path                → proxy aem.live `.plain.html`
 *
 * The block JS reads window.location.pathname to fetch the right data.
 */

const AEM_PAGE_BASE = 'https://main--asisa-pc--asisa-softtek.aem.page';
const AEM_LIVE_BASE = 'https://main--asisa-pc--asisa-softtek.aem.live';

const PROVINCIA_TEMPLATE = `<!DOCTYPE html>
<html>
<head><title>Cuadro Médico</title></head>
<body>
<header></header>
<main>
<div>
<div class="cuadro-medico"><div><div></div></div></div>
<div class="cuadro-medico-top-especialidades"><div><div></div></div></div>
<div class="cuadro-medico-otras-especialidades"><div><div></div></div></div>
<div class="cuadro-medico-otras-provincias"><div><div></div></div></div>
</div>
</main>
<footer></footer>
</body>
</html>`;

const DOCTOR_TEMPLATE = `<!DOCTYPE html>
<html>
<head><title>Ficha de Médico</title></head>
<body>
<header></header>
<main>
<div>
<div class="cuadro-medico-ficha-doctor"><div><div></div></div></div>
<div class="cuadro-medico-otros-medicos"><div><div></div></div></div>
<div class="cuadro-medico-spec-localizacion"><div><div></div></div></div>
</div>
</main>
<footer></footer>
</body>
</html>`;

const ESPECIALIDAD_TEMPLATE = `<!DOCTYPE html>
<html>
<head><title>Cuadro Médico por Especialidad</title></head>
<body>
<header></header>
<main>
<div>
<div class="cuadro-medico"><div><div></div></div></div>
<div class="cuadro-medico-top-especialidades"><div><div></div></div></div>
<div class="cuadro-medico-otras-especialidades"><div><div></div></div></div>
<div class="cuadro-medico-otras-provincias"><div><div></div></div></div>
</div>
</main>
<footer></footer>
</body>
</html>`;

function sendHtml(res, html, cacheSeconds = 3600) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', `public, max-age=${cacheSeconds}`);
  res.status(200).send(html);
}

function extractPath(req) {
  // Vercel rewrite `/markup/(.*)` → `/api/markup?path=$1`
  // For root markup → `/api/markup?path=`
  let p = req.query?.path || '';
  if (typeof p !== 'string') p = String(p);
  // Strip leading slashes
  while (p.startsWith('/')) p = p.slice(1);
  // Strip trailing .html / .plain.html that EDS may append via suffix
  if (p.endsWith('.plain.html')) p = p.slice(0, -'.plain.html'.length);
  else if (p.endsWith('.html')) p = p.slice(0, -'.html'.length);
  return `/${p}`;
}

function isProvinciaPath(path) {
  return /^\/cuadro-medico\/p(\/.+)?$/.test(path) && path !== '/cuadro-medico/p';
}

function isDoctorPath(path) {
  return /^\/cuadro-medico\/d\/.+$/.test(path);
}

function isEspecialidadPath(path) {
  return /^\/cuadro-medico\/e\/.+$/.test(path);
}

async function tryFetch(base, safe) {
  const url = `${base}${safe}.plain.html`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'asisa-pc-byom/1.0' } });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  }
}

async function proxyAem(path, res) {
  const safe = path === '/' ? '/index' : path;
  // Try aem.page first (has both preview + live cached), then aem.live as fallback
  let html = await tryFetch(AEM_PAGE_BASE, safe);
  let source = 'aem-page';
  if (html === null) {
    html = await tryFetch(AEM_LIVE_BASE, safe);
    source = 'aem-live';
  }
  if (html === null) {
    res.setHeader('x-source', 'aem-404');
    res.status(404).send(`Not found at ${safe}.plain.html`);
    return;
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.setHeader('x-source', `${source}:${safe}.plain.html`);
  res.status(200).send(html);
}

export default async function handler(req, res) {
  const path = extractPath(req);

  if (isProvinciaPath(path)) {
    res.setHeader('x-source', 'template:provincia');
    return sendHtml(res, PROVINCIA_TEMPLATE);
  }
  if (isDoctorPath(path)) {
    res.setHeader('x-source', 'template:doctor');
    return sendHtml(res, DOCTOR_TEMPLATE);
  }
  if (isEspecialidadPath(path)) {
    res.setHeader('x-source', 'template:especialidad');
    return sendHtml(res, ESPECIALIDAD_TEMPLATE);
  }

  // Everything else → proxy aem.page first (preview-cached), aem.live as fallback
  return proxyAem(path, res);
}
