/**
 * Bloque "cuadro-medico-ficha-doctor".
 *
 * Ficha completa del médico. Lee la URL:  /cuadro-medico/d/{key}
 *
 * Un médico (agrupado por colegiado) puede ejercer en varios centros.
 * Renderiza:
 *   - Header con nombre, colegiado y especialidades únicas.
 *   - Una card por cada ubicación con su dirección, servicios, teléfono y CTA "Pedir cita".
 *
 * UI con clases del design system ASISA (clientlib-site.min.css).
 */

const API_BASE = 'https://asisa-pc.vercel.app';
const ASISA_SEARCH = 'https://www.asisa.es/asegurado/salud/cuadro-medico/resultados-cuadro-medico';
const ASISA_SEARCH_PUBLIC = 'https://www.asisa.es/cuadro-medico/resultados-cuadro-medico';

function getKeyFromUrl() {
  const parts = window.location.pathname.split('/');
  const dIdx = parts.indexOf('d');
  return dIdx !== -1 ? parts[dIdx + 1] : null;
}

function formatName(raw) {
  if (!raw) return '';
  return raw.toLowerCase().split(/(\s+)/).map((w) => (w && /\S/.test(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join('');
}

function formatPersonName(raw) {
  if (!raw) return '';
  const [last = '', first = ''] = raw.split(',').map((s) => s.trim());
  const ordered = first ? `${first} ${last}` : last;
  const formatted = formatName(ordered);
  const given = formatted.split(/\s+/)[0] || '';
  const prefix = /a$/i.test(given) ? 'Dra.' : 'Dr.';
  return `${prefix} ${formatted}`;
}

function buildShareUrl(d, loc, provinciaDisplayName) {
  const params = new URLSearchParams({
    networkId: '1',
    networkName: 'Salud',
    ordination: 'Relevance',
    ordinationName: 'Relevancia',
    address: `${provinciaDisplayName || loc.city || ''}, España`,
    provinceId: loc.provinceCode || '',
    speciality: loc.speciality || d.specialities?.[0] || '',
    specialityName: loc.speciality || d.specialities?.[0] || '',
    specialityType: '1',
  });
  if (loc.lat && loc.lon) { params.set('latitude', loc.lat); params.set('longitude', loc.lon); }
  return `${ASISA_SEARCH_PUBLIC}?${params}`;
}

function buildCitaUrl(d, loc, provinciaDisplayName) {
  const params = new URLSearchParams({
    networkId: '1',
    networkName: 'Salud',
    ordination: 'Relevance',
    ordinationName: 'Relevancia',
    address: `${provinciaDisplayName || loc.city || ''}, España`,
    provinceId: loc.provinceCode || '',
    speciality: loc.speciality || '',
    specialityName: loc.speciality || '',
    specialityType: '1',
    fromPublicArea: 'true',
    concept: d.name,
  });
  if (loc.lat && loc.lon) { params.set('latitude', loc.lat); params.set('longitude', loc.lon); }
  return `${ASISA_SEARCH}?${params}`;
}

function renderServiceTags(loc) {
  const tags = [];
  if (loc.onlineAppointment) tags.push('<div class="cmp-tag-template cmp-tag-template--blank"><div class="cmp-tag-template__text">Cita online</div></div>');
  if (loc.videoConsultation) tags.push('<div class="cmp-tag-template cmp-tag-template--blank"><div class="cmp-tag-template__text">Videoconsulta</div></div>');
  if (loc.ePrescription) tags.push('<div class="cmp-tag-template cmp-tag-template--blank"><div class="cmp-tag-template__text">Receta electrónica</div></div>');
  return tags.join('');
}

function renderDoctorHeader(d) {
  const name = formatPersonName(d.name);
  const specName = formatName(d.specialities?.[0] || '');
  const titleSuffix = specName ? `, ${specName}` : '';
  const introBody = specName
    ? `Consulta la ficha de ${name}, especialista en ${specName} dentro del cuadro médico de ASISA. Encuentra información sobre su especialidad y centros donde atiende.`
    : `Consulta la ficha de ${name} dentro del cuadro médico de ASISA. Encuentra información sobre su especialidad y centros donde atiende.`;
  return `<section class="eds-mp-box-head">
        <h1 class="eds-mp-box-head--title">${name}${titleSuffix}</h1>
        <p class="eds-mp-box-head--text">${introBody}</p>
      </section>`;
}

function toCentroSlug(raw) {
  return String(raw || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function renderCenterLink(parentDescription) {
  if (!parentDescription) return '';
  const slug = toCentroSlug(parentDescription);
  const display = formatName(parentDescription);
  return slug ? `<a href="/cuadro-medico/c/${slug}">${display}</a>` : display;
}

function renderLocationCard(d, loc, idx, provinciaDisplayName) {
  const mapsUrl = (loc.lat && loc.lon) ? `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lon}` : '';
  const addressLine = [loc.address, loc.postalCode, loc.city].filter(Boolean).join(', ');
  const shareUrl = buildShareUrl(d, loc, provinciaDisplayName);
  const centerHtml = renderCenterLink(loc.parentDescription);
  const speciality = formatName(loc.speciality || '');
  const isFirst = idx === 0;

  return `<div class="cmp-medical-detail__first-block">
    <div class="cmp-medical-detail__title-block">
      <div class="cmp-medical-detail__title-block__tags">
        <div class="cmp-medical-detail__title-block__tags--item">
          <div class="cmp-tag-template cmp-tag-template--blue">
            <div class="cmp-tag-template__text">${isFirst ? 'MÉDICO / PROFESIONAL' : 'CENTRO MÉDICO'}</div>
          </div>
        </div>
        ${loc.businessGroup ? '<div class="cmp-tag-template cmp-tag-template--blank"><div class="cmp-tag-template__text">Centro de ASISA</div></div>' : ''}
        <a class="cmp-medical-detail__title-block__tags--share" href="${shareUrl}" target="_blank" rel="noopener">
          Compartir <i class="icon-share-021"></i>
        </a>
      </div>
      ${isFirst ? `
        <p class="cmp-medical-detail__title-block--speciality">${speciality}</p>
        <div class="cmp-title">
          <h1 class="cmp-title__text">${formatPersonName(d.name)}</h1>
        </div>
        ${d.collegiateCode ? `<p class="cmp-medical-detail__title-block--num-member"><em>Núm. Colegiado – ${d.collegiateCode}</em></p>` : ''}
      ` : `
        <div class="cmp-title">
          <h3 class="cmp-title__text">${centerHtml || speciality}</h3>
        </div>
      `}
    </div>
    <div class="cmp-medical-detail__address-block">
      ${centerHtml && isFirst ? `<div class="cmp-medical-detail__address-block--center">${centerHtml}</div>` : ''}
      ${addressLine ? `<div class="cmp-medical-detail__address-block--name"><i class="icon-marker-02"></i>${formatName(addressLine)}</div>` : ''}
      <div class="cmp-medical-detail__address-block__location">
        ${mapsUrl ? `<div class="cmp-medical-detail__address-block__location--reach"><div class="button-cmp"><a href="${mapsUrl}" target="_blank" rel="noopener" class="btn button-cmp__text button-cmp__text--link button-location"><i class="icon-map-04 icon-large"></i>Cómo llegar</a></div></div>` : ''}
      </div>
      <div class="cmp-medical-detail__address-block__tags">${renderServiceTags(loc)}</div>
    </div>
    ${loc.phone ? `<div class="cmp-medical-detail__buttons-block">
      <div class="button-cmp"><a href="tel:${loc.phone}" class="btn button-cmp__text button-cmp__text--link"><i class="icon-phone"></i>${loc.phone}</a></div>
    </div>` : ''}
  </div>`;
}

function renderSpecCard(d, loc, provinciaDisplayName) {
  const citaUrl = buildCitaUrl(d, loc, provinciaDisplayName);
  const ctaLabel = loc.onlineAppointment ? 'Pedir cita online' : 'Pedir cita';
  const title = formatName(loc.speciality || d.specialities?.[0] || '');

  return `<div class="cmp-medical-detail__first-block cmp-medical-detail--blue">
    <div class="cmp-medical-detail__title-block">
      <div class="cmp-title">
        <h2 class="cmp-title__text">${title}</h2>
      </div>
    </div>
    <div class="cmp-medical-detail__buttons-block">
      ${loc.phone ? `<div class="button-cmp"><a href="tel:${loc.phone}" class="btn button-cmp__text button-cmp__text--link"><i class="icon-phone"></i>${loc.phone}</a></div>` : ''}
      <div class="button-cmp"><a href="${citaUrl}" target="_blank" rel="noopener" class="btn button-cmp__text button-cmp__text--primary">${ctaLabel}</a></div>
    </div>
  </div>`;
}

function renderOtherLocationsHeading(d) {
  return `<h2 class="cmp-medical-detail__subtitle">${formatPersonName(d.name)} también trabaja en estos centros</h2>`;
}

export default function decorate(block) {
  const key = getKeyFromUrl();
  if (!key) { block.hidden = true; return; }

  // El overlay (api/markup.js · ssrDoctor) emite SSR para Googlebot, pero EDS
  // hace auto-blocking y descarta las clases CSS internas, por lo que ese SSR
  // no respeta el design system. Aquí renderizamos siempre la versión
  // estilada y quitamos el sibling de ubicaciones adicionales que el overlay
  // emitió por SEO (sino se vería duplicado).
  const silent = block.children.length > 0;
  if (!silent) block.innerHTML = '<p>Cargando médico…</p>';

  Promise.all([
    fetch(`${API_BASE}/api/doctor?key=${key}`).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
    fetch(`${API_BASE}/api/provincias`).then((r) => r.json()),
  ])
    .then(([d, provincias]) => {
      const provinciaDisplayName = (loc) => {
        const prov = provincias.find((p) => p.slug === loc.provinceSlug);
        return prov?.displayName || loc.provinceSlug;
      };

      const locs = d.locations || [];
      if (!locs.length) {
        block.innerHTML = '<p>No se pudo cargar la ficha del médico.</p>';
        return;
      }

      const parts = [renderDoctorHeader(d)];
      parts.push(renderLocationCard(d, locs[0], 0, provinciaDisplayName(locs[0])));
      parts.push(renderSpecCard(d, locs[0], provinciaDisplayName(locs[0])));

      if (locs.length > 1) {
        parts.push(renderOtherLocationsHeading(d));
        for (let i = 1; i < locs.length; i += 1) {
          parts.push(renderLocationCard(d, locs[i], i, provinciaDisplayName(locs[i])));
          parts.push(renderSpecCard(d, locs[i], provinciaDisplayName(locs[i])));
        }
      }

      block.innerHTML = `<div class="cmp-medical-detail">${parts.join('')}</div>`;
      // Limpiar el sibling de SEO con ubicaciones adicionales (ya renderizamos
      // todas las ubicaciones aquí, estiladas).
      const locsSibling = document.querySelector('.cuadro-medico-ficha-doctor-locations');
      if (locsSibling) {
        const wrapper = locsSibling.closest('.section') || locsSibling;
        wrapper.remove();
      }
    })
    .catch(() => {
      if (!silent) block.innerHTML = '<p>No se pudo cargar la ficha del médico.</p>';
    });
}
