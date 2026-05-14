/* eslint-disable no-console */
/**
 * BYOM overlay markup endpoint for EDS.
 *
 * The EDS config service is configured with:
 *   - primary source: AEM author franklin.delivery URL
 *   - overlay: https://asisa-pc.vercel.app/markup (this endpoint)
 *
 * EDS checks this overlay first for every path:
 *   - For /cuadro-medico/p/<slug>       → returns provincia template HTML
 *   - For /cuadro-medico/p/<prov>/pe/.. → returns provincia template HTML
 *   - For /cuadro-medico/d/<slug>       → returns doctor template HTML
 *   - For /cuadro-medico/e/<slug>       → returns especialidad template HTML
 *   - For everything else               → 404, so EDS falls back to AEM
 *
 * The block JS in the rendered page reads window.location.pathname
 * to fetch the right data from Vercel APIs.
 */

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

function sendHtml(res, html, source) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('x-source', source);
  res.status(200).send(html);
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

function isEspecialidadPath(path) {
  return /^\/cuadro-medico\/e\/.+$/.test(path);
}

export default async function handler(req, res) {
  const path = extractPath(req);

  if (isProvinciaPath(path)) {
    return sendHtml(res, PROVINCIA_TEMPLATE, 'template:provincia');
  }
  if (isDoctorPath(path)) {
    return sendHtml(res, DOCTOR_TEMPLATE, 'template:doctor');
  }
  if (isEspecialidadPath(path)) {
    return sendHtml(res, ESPECIALIDAD_TEMPLATE, 'template:especialidad');
  }

  // No overlay for this path → 404 makes EDS fall through to AEM source
  return send404(res, path);
}
