/* eslint-disable no-console, no-use-before-define */
/**
 * BYOM overlay endpoint para EDS. Hace SSR del contenido de cada URL del cuadro
 * médico de manera que el HTML servido a crawlers contiene <title>, meta description,
 * <h1>, intro y los primeros resultados ya renderizados. Los bloques JS hidratan
 * la interactividad (tabs, paginación) sobre ese DOM sin redownload.
 *
 *   /markup/cuadro-medico/p/<slug>           → listado por provincia (SSR)
 *   /markup/cuadro-medico/p/<prov>/pe/<spec> → listado provincia+especialidad (SSR)
 *   /markup/cuadro-medico/e/<slug>           → listado nacional por especialidad (SSR)
 *   /markup/cuadro-medico/d/<key>            → ficha de profesional (SSR)
 *   /markup/cuadro-medico/c/<key>            → ficha de centro (SSR)
 *   /markup/sitemap.xml                      → sitemap index
 *   /markup/sitemap-cuadro-medico-*.xml      → sitemap por tipo
 *   /markup/<other>                          → 404 (overlay-pass)
 */

import { fetchProvincias, fetchProvincia } from './provincias.js';
import { fetchEspecialidadesMaster, fetchEspecialidad } from './especialidades.js';
import { fetchProviders } from './providers.js';
import { fetchDoctor } from './doctor.js';
import { fetchCentro } from './centro.js';
import { getSitemapIndexXml } from './sitemap.js';
import { getCuadroMedicoSitemapXml } from './sitemap-cuadro-medico.js';

const ASISA_HOST = 'https://www.asisa.es';

// ---------------- helpers ----------------
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function titleCase(s) {
  if (!s) return '';
  return s.toLowerCase().split(/(\s+)/)
    .map((w) => (w && /\S/.test(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join('');
}

function formatPersonName(name) {
  if (!name) return '';
  const parts = name.split(',');
  const ordered = parts.length === 2 ? `${parts[1].trim()} ${parts[0].trim()}` : name;
  const formatted = titleCase(ordered);
  const given = formatted.split(/\s+/)[0] || '';
  const prefix = /a$/i.test(given) ? 'Dra.' : 'Dr.';
  return `${prefix} ${formatted}`;
}

function getProviderTag(p) {
  if (String(p.doctorType) === '1') return 'MÉDICO / PROFESIONAL';
  if (String(p.providerType) === '3') return 'HOSPITAL';
  if (String(p.providerType) === '4') return 'CENTRO MÉDICO';
  if (String(p.providerType) === '8') return 'LABORATORIO';
  if (String(p.providerType) === '2') return 'TRANSPORTE SANITARIO';
  if (String(p.providerType) === '9') return 'OXIGENOTERAPIA';
  return 'PROVEEDOR';
}

function renderCard(p, isProfessional) {
  const displayName = isProfessional ? formatPersonName(p.name) : titleCase(p.name);
  const speciality = titleCase(p.speciality || '');
  const fullAddress = [p.address, p.postalCode, p.city].filter(Boolean).join(', ');
  const formattedAddress = titleCase(fullAddress);
  const mapsUrl = (p.lat && p.lon)
    ? `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}` : '';
  const langTags = (p.languages || [])
    .map((l) => `<div class="cmp-tag-template cmp-tag-template--blank"><div class="cmp-tag-template__text">${esc(l)}</div></div>`)
    .join('');

  return `<div class="eds-mp-card">
  <div class="eds-mp-card__principal-tag">
    <div class="cmp-tag-template cmp-tag-template--blue"><div class="cmp-tag-template__text">${esc(getProviderTag(p))}</div></div>
    ${p.businessGroup ? '<div class="cmp-tag-template cmp-tag-template--blank"><div class="cmp-tag-template__text">Centro de ASISA</div></div>' : ''}
    ${p.ePrescription ? '<div class="cmp-tag-template cmp-tag-template--blank"><div class="cmp-tag-template__text">Receta electrónica</div></div>' : ''}
  </div>
  <div class="eds-mp-card__info">
    <div class="eds-mp-card__info--contact">
      ${speciality ? `<p class="eds-mp-card__type--speciality">${esc(speciality)}</p>` : ''}
      <p class="eds-mp-card__type--name">${esc(displayName)}</p>
      ${(isProfessional && p.collegiateCode) ? `<p class="eds-mp-card__type--num-member">Núm. Colegiado – ${esc(p.collegiateCode)}</p>` : ''}
      ${p.parentDescription ? `<p class="eds-mp-card__type--center">${esc(titleCase(p.parentDescription))}</p>` : ''}
      ${formattedAddress ? `<div class="eds-mp-card__type--address"><i class="icon-marker-02"></i>${esc(formattedAddress)}</div>` : ''}
      <div class="eds-mp-card__info--location">
        ${mapsUrl ? `<div class="eds-mp-card__type--location"><div class="button-cmp"><a href="${esc(mapsUrl)}" target="_blank" rel="noopener" class="button-cmp__text button-cmp__text--link button-location"><i class="icon-map-04 icon-large"></i>Cómo llegar</a></div></div>` : ''}
        ${p.phone ? `<div class="eds-mp-card__type--phone"><div class="button-cmp"><a href="tel:${esc(p.phone)}" class="button-cmp__text button-cmp__text--link button-location"><i class="icon-phone"></i>${esc(p.phone)}</a></div></div>` : ''}
      </div>
    </div>
    <div class="eds-mp-card__info--tags">
      ${p.onlineAppointment ? '<div class="cmp-tag-template cmp-tag-template--blank"><div class="cmp-tag-template__text">Cita online</div></div>' : ''}
      ${langTags}
    </div>
  </div>
  <div class="eds-mp-card__info--buttons">
    <div class="eds-mp-card__info--buttons-detail">
      <div class="button-cmp"><a href="${esc(p.detailUrl || '#')}" class="btn button-cmp__text button-cmp__text--primary">Ver detalle</a></div>
    </div>
  </div>
</div>`;
}

// ---------------- SSR builders ----------------
function ssrOtrasEspecialidades({ provSlug, specSlug, provDisplay }) {
  const allEspec = fetchEspecialidadesMaster();
  if (provSlug) {
    const provDetail = fetchProvincia(provSlug);
    const provSpecsSet = new Set(provDetail?.especialidades || []);
    const specs = allEspec.filter((e) => provSpecsSet.has(e.slug));
    if (!specs.length) return '';
    const items = specs.map((e) => `<li><a class="cmp-tag-template cmp-tag-template--blue-100" href="/cuadro-medico/p/${esc(provSlug)}/pe/${esc(e.slug)}"><span class="cmp-tag-template__text">${esc(e.name)}</span></a></li>`).join('');
    return `<div class="cuadro-medico-otras-especialidades">
  <div class="eds-mp-other-specs">
    <h2 class="eds-mp-other-specs__title">Otras especialidades en ${esc(provDisplay)}</h2>
    <ul class="eds-mp-other-specs__container">${items}</ul>
  </div>
</div>`;
  }
  // National mode
  const top = allEspec.filter((e) => e.kind !== 'service').slice(0, 15);
  if (!top.length) return '';
  const chips = top.map((e) => {
    const variant = e.slug === specSlug ? 'cmp-tag-template--blue' : 'cmp-tag-template--blank';
    return `<a class="cmp-tag-template ${variant}" href="/cuadro-medico/e/${esc(e.slug)}"><span class="cmp-tag-template__text">${esc(e.name)}</span></a>`;
  }).join('');
  return `<div class="cuadro-medico-otras-especialidades">
  <h2 class="cmp-medical-detail__subtitle">Otras especialidades del Cuadro médico ASISA</h2>
  <div class="cmp-medical-detail__other-specialities">${chips}</div>
</div>`;
}

function ssrOtrasProvincias({ provSlug, specSlug }) {
  if (!specSlug) return '<div class="cuadro-medico-otras-provincias"></div>';
  const detail = fetchEspecialidad(specSlug);
  if (!detail) return '<div class="cuadro-medico-otras-provincias"></div>';
  const provincias = (detail.provincias || []).filter((p) => p.slug !== provSlug);
  if (!provincias.length) return '<div class="cuadro-medico-otras-provincias"></div>';
  const specName = detail.name || specSlug;
  const specLower = specName.toLowerCase();
  const cards = provincias.map((p) => `<article class="cm-otras-prov-card">
  <h3 class="cm-otras-prov-card__name">${esc(specName)} ${esc(p.displayName)}</h3>
  <p class="cm-otras-prov-card__count">${p.count} profesionales</p>
  <a class="cm-otras-prov-card__arrow" href="/cuadro-medico/p/${esc(p.slug)}/pe/${esc(specSlug)}" aria-label="Ver ${esc(specName)} en ${esc(p.displayName)}">→</a>
</article>`).join('');
  return `<div class="cuadro-medico-otras-provincias">
  <h2 class="cm-otras-prov-title">Otras provincias con ${esc(specLower)} ASISA</h2>
  <div class="cm-otras-prov-list">${cards}</div>
</div>`;
}

function ssrListing({ provSlug, specSlug, nationalSpec }) {
  // Resolve display data
  const prov = provSlug ? fetchProvincias().find((p) => p.slug === provSlug) : null;
  if (provSlug && !prov) return null;
  const espec = specSlug ? fetchEspecialidadesMaster().find((e) => e.slug === specSlug) : null;
  if (specSlug && !espec) return null;

  const locationName = prov?.displayName || '';
  const specName = espec?.name || '';
  const provinceCode = prov?.provinceCode || '';

  // Fetch first page of professionals SSR
  const data = fetchProviders({
    provinceSlug: provSlug || undefined,
    specSlug: specSlug || undefined,
    tab: 'professionals',
    page: 1,
  });
  if (data.error) return null;

  const totalProf = data.totalProfessionals;
  const totalCenters = data.totalCenters;
  const results = data.results || [];
  const totalPages = data.totalPages || 1;
  const cards = results.map((p) => renderCard(p, true)).join('');

  // Title + intro
  let h1; let intro; let title; let description;
  if (nationalSpec) {
    h1 = `Especialistas en ${specName} con ASISA`;
    intro = `Encuentra especialistas en ${specName} dentro del cuadro médico de ASISA. Consulta médicos, clínicas y hospitales disponibles y accede fácilmente a atención sanitaria especializada cerca de ti.`;
    title = `${specName} - Cuadro Médico ASISA`;
    description = `${totalProf} ${(espec?.professionalPluralLower || specName).toLowerCase()} del cuadro médico ASISA. Encuentra el especialista que necesitas en toda España.`;
  } else if (specSlug) {
    h1 = `${specName} en ${locationName}`;
    intro = `Encuentra especialistas en ${specName} en ${locationName} dentro del cuadro médico de ASISA. Consulta médicos, hospitales y clínicas donde recibir atención especializada y accede a la información de cada profesional de forma rápida y sencilla.`;
    title = `${specName} en ${locationName} - Cuadro Médico ASISA`;
    description = `${totalProf} ${(espec?.professionalPluralLower || specName).toLowerCase()} del cuadro médico ASISA en ${locationName}. Encuentra tu especialista y pide cita.`;
  } else {
    h1 = `Cuadro Médico de ASISA en ${locationName}`;
    intro = `Consulta el cuadro médico de ASISA en ${locationName} y encuentra hospitales, clínicas y especialistas cerca de ti. Localiza médicos por especialidad, consulta información de los centros y accede fácilmente a los servicios disponibles. Encuentra el profesional que necesitas y pide cita con ASISA de forma rápida y sencilla.`;
    title = `Cuadro Médico ASISA en ${locationName}`;
    description = `Cuadro médico ASISA en ${locationName}: ${totalProf} profesionales y ${totalCenters} centros disponibles. Encuentra tu médico y pide cita.`;
  }

  const dataAttrs = [
    `data-ssr="true"`,
    `data-tab="professionals"`,
    `data-page="1"`,
    `data-total-prof="${totalProf}"`,
    `data-total-centers="${totalCenters}"`,
    `data-total-pages="${totalPages}"`,
    `data-location-name="${esc(locationName)}"`,
    `data-province-code="${esc(provinceCode)}"`,
    `data-spec-name="${esc(specName)}"`,
  ].join(' ');

  const cuadroMedicoBlock = `<div class="cuadro-medico cmp-medical-picture-result" data-ssr="true">
  <section class="eds-mp-box-head">
    <h1 class="eds-mp-box-head--title">${esc(h1)}</h1>
    <p class="eds-mp-box-head--text">${esc(intro)}</p>
  </section>
  <div class="eds-mp-tabs" ${dataAttrs}>
    <ul class="eds-mp-tabs__nav">
      <li class="eds-mp-tabs__nav--item active" data-tab="professionals">Profesionales (${totalProf})</li>
      <li class="eds-mp-tabs__nav--item" data-tab="centers">Centros médicos (${totalCenters})</li>
    </ul>
    <div class="eds-mp-tabs__container">
      <div class="eds-mp-tabs__content">${cards}</div>
    </div>
  </div>
</div>`;

  const otrasEspecs = ssrOtrasEspecialidades({ provSlug, specSlug, provDisplay: locationName });
  const otrasProvs = ssrOtrasProvincias({ provSlug, specSlug });

  return { title, description, blocks: `${cuadroMedicoBlock}\n${otrasEspecs}\n${otrasProvs}` };
}

function ssrDoctor(key) {
  const data = fetchDoctor(key);
  if (data.error) return null;

  const provs = fetchProvincias();
  const provDisplay = provs.find((p) => p.slug === data.provinceSlug)?.displayName || '';
  const displayName = formatPersonName(data.name);
  const specialities = data.specialities || [];
  const mainSpec = specialities[0] || '';

  const title = `${displayName}${mainSpec ? `, ${titleCase(mainSpec)}` : ''} - Cuadro Médico ASISA`;
  const description = `${displayName}, ${titleCase(mainSpec)} en ${provDisplay} del cuadro médico ASISA. Consulta dirección, teléfono y pide cita.`;
  const h1 = `${displayName}${mainSpec ? `, ${titleCase(mainSpec)}` : ''}`;
  const intro = `Ficha del cuadro médico de ASISA con la información de contacto, especialidades y centros donde pasa consulta ${displayName}.`;

  const blocks = `<div class="cuadro-medico-ficha-doctor cmp-medical-detail" data-ssr="true" data-key="${esc(key)}">
  <section class="eds-mp-box-head">
    <h1 class="eds-mp-box-head--title">${esc(h1)}</h1>
    <p class="eds-mp-box-head--text">${esc(intro)}</p>
  </section>
  <div class="cmp-medical-detail__first-block">
    <div class="cmp-medical-detail__title-block">
      <div class="cmp-medical-detail__title-block__tags">
        <div class="cmp-tag-template cmp-tag-template--blue"><div class="cmp-tag-template__text">MÉDICO / PROFESIONAL</div></div>
        ${data.businessGroup ? '<div class="cmp-tag-template cmp-tag-template--blank"><div class="cmp-tag-template__text">Centro de ASISA</div></div>' : ''}
        ${data.ePrescription ? '<div class="cmp-tag-template cmp-tag-template--blank"><div class="cmp-tag-template__text">Receta electrónica</div></div>' : ''}
      </div>
      ${mainSpec ? `<p class="cmp-medical-detail__title-block--speciality">${esc(titleCase(mainSpec))}</p>` : ''}
      <div class="cmp-title"><h2 class="cmp-title__text">${esc(displayName)}</h2></div>
      ${data.collegiateCode ? `<p class="cmp-medical-detail__title-block--num-member">Núm. Colegiado – ${esc(data.collegiateCode)}</p>` : ''}
    </div>
    <div class="cmp-medical-detail__address-block">
      ${data.parentDescription ? `<div class="cmp-medical-detail__address-block--center">${esc(titleCase(data.parentDescription))}</div>` : ''}
      ${data.address ? `<div class="cmp-medical-detail__address-block--name"><i class="icon-marker-02"></i>${esc(titleCase([data.address, data.postalCode, data.city].filter(Boolean).join(', ')))}</div>` : ''}
    </div>
    <div class="cmp-medical-detail__buttons-block">
      ${data.phone ? `<div class="button-cmp"><a href="tel:${esc(data.phone)}" class="button-cmp__text button-cmp__text--link"><i class="icon-phone"></i>${esc(data.phone)}</a></div>` : ''}
    </div>
  </div>
</div>
<div class="cuadro-medico-otros-medicos"><div><div></div></div></div>`;

  return { title, description, blocks };
}

function ssrCentro(key) {
  const data = fetchCentro(key);
  if (data?.error) return null;
  if (!data) return null;

  const provs = fetchProvincias();
  const provDisplay = provs.find((p) => p.slug === data.provinceSlug)?.displayName || '';
  const centerName = titleCase(data.name);
  const specCount = (data.specialities || []).length;
  const docCount = (data.doctors || []).length;

  const h1 = `${centerName} en ${provDisplay}`;
  const title = `${centerName} - Cuadro Médico ASISA`;
  const description = data.description
    || `${centerName} en ${provDisplay}. Centro del cuadro médico ASISA con ${specCount} especialidades y ${docCount} profesionales.`;
  const intro = `Centro del cuadro médico de ASISA en ${provDisplay}. Consulta especialidades, médicos, dirección y teléfono.`;

  // Pre-renderizamos las primeras 5 especialidades como lista plana para SEO
  const specsList = (data.specialities || []).slice(0, 5).map((s) => `<li>${esc(titleCase(s.speciality))}</li>`).join('');

  const blocks = `<div class="cuadro-medico-ficha-centro cmp-medical-detail" data-ssr="true" data-key="${esc(key)}">
  <section class="eds-mp-box-head">
    <h1 class="eds-mp-box-head--title">${esc(h1)}</h1>
    <p class="eds-mp-box-head--text">${esc(intro)}</p>
  </section>
  <div class="cmp-medical-detail__first-block">
    <div class="cmp-medical-detail__title-block">
      <div class="cmp-medical-detail__title-block__tags">
        <div class="cmp-tag-template cmp-tag-template--blue"><div class="cmp-tag-template__text">CENTRO MÉDICO</div></div>
        ${data.businessGroup ? '<div class="cmp-tag-template cmp-tag-template--blank"><div class="cmp-tag-template__text">Centro de ASISA</div></div>' : ''}
      </div>
      <div class="cmp-title"><h2 class="cmp-title__text">${esc(centerName)}</h2></div>
    </div>
    <div class="cmp-medical-detail__address-block">
      ${data.address ? `<div class="cmp-medical-detail__address-block--name"><i class="icon-marker-02"></i>${esc(titleCase([data.address, data.postalCode, data.city].filter(Boolean).join(', ')))}</div>` : ''}
    </div>
    <div class="cmp-medical-detail__buttons-block">
      ${data.phone ? `<div class="button-cmp"><a href="tel:${esc(data.phone)}" class="button-cmp__text button-cmp__text--link"><i class="icon-phone"></i>${esc(data.phone)}</a></div>` : ''}
    </div>
  </div>
  ${specsList ? `<section class="cm-fcentro__specs-section">
    <h2 class="cmp-medical-detail__subtitle">Especialidades médicas del centro</h2>
    <ul class="cm-fcentro__specs-summary">${specsList}</ul>
  </section>` : ''}
</div>`;

  return { title, description, blocks };
}

// ---------------- response builder ----------------
function buildPage({
  path, title, description, blocks,
}) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
${description ? `<meta name="description" content="${esc(description)}">` : ''}
<link rel="canonical" href="${ASISA_HOST}${esc(path)}">
<meta property="og:title" content="${esc(title)}">
${description ? `<meta property="og:description" content="${esc(description)}">` : ''}
<meta property="og:url" content="${ASISA_HOST}${esc(path)}">
<meta property="og:type" content="website">
<script>
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
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
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

// ---------------- router ----------------
const PROVINCIA_PE_RE = /^\/cuadro-medico\/p\/([^/]+)\/pe\/([^/]+)$/;
const PROVINCIA_RE = /^\/cuadro-medico\/p\/([^/]+)$/;
const ESPECIALIDAD_RE = /^\/cuadro-medico\/e\/([^/]+)$/;
const DOCTOR_RE = /^\/cuadro-medico\/d\/([^/]+)$/;
const CENTRO_RE = /^\/cuadro-medico\/c\/([^/]+)$/;
const SITEMAP_TYPE_RE = /^\/sitemap-cuadro-medico-(provincias|provincia-specs|doctores|centros|especialidades)\.xml$/;

export default function handler(req, res) {
  const path = extractPath(req);

  try {
    let m;
    // Provincia + especialidad
    m = path.match(PROVINCIA_PE_RE);
    if (m) {
      const out = ssrListing({ provSlug: m[1], specSlug: m[2], nationalSpec: false });
      if (out) return sendHtml(res, buildPage({ path, ...out }), 'ssr:provincia-spec');
    }
    // Solo provincia
    m = path.match(PROVINCIA_RE);
    if (m) {
      const out = ssrListing({ provSlug: m[1], specSlug: null, nationalSpec: false });
      if (out) return sendHtml(res, buildPage({ path, ...out }), 'ssr:provincia');
    }
    // Especialidad nacional
    m = path.match(ESPECIALIDAD_RE);
    if (m) {
      const out = ssrListing({ provSlug: null, specSlug: m[1], nationalSpec: true });
      if (out) return sendHtml(res, buildPage({ path, ...out }), 'ssr:especialidad');
    }
    // Ficha doctor
    m = path.match(DOCTOR_RE);
    if (m) {
      const out = ssrDoctor(m[1]);
      if (out) return sendHtml(res, buildPage({ path, ...out }), 'ssr:doctor');
    }
    // Ficha centro
    m = path.match(CENTRO_RE);
    if (m) {
      const out = ssrCentro(m[1]);
      if (out) return sendHtml(res, buildPage({ path, ...out }), 'ssr:centro');
    }
    // Sitemaps
    if (path === '/sitemap.xml') return sendXml(res, getSitemapIndexXml(), 'sitemap:index');
    m = path.match(SITEMAP_TYPE_RE);
    if (m) {
      const xml = getCuadroMedicoSitemapXml(m[1]);
      if (xml) return sendXml(res, xml, `sitemap:${m[1]}`);
    }
  } catch (err) {
    console.error('markup error', path, err);
  }

  return send404(res, path);
}
