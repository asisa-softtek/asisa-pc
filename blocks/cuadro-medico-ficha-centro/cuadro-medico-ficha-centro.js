/**
 * Bloque "cuadro-medico-ficha-centro".
 *
 * Ficha completa de un centro médico. Lee la URL:  /cuadro-medico/c/{key}
 *
 * UI con clases del design system ASISA (clientlib-site.min.css).
 */

const API_BASE = 'https://asisa-pc.vercel.app';
const ASISA_SEARCH = 'https://www.asisa.es/asegurado/salud/cuadro-medico/resultados-cuadro-medico';
const ASISA_SEARCH_PUBLIC = 'https://www.asisa.es/cuadro-medico/resultados-cuadro-medico';

function getKeyFromUrl() {
  const parts = window.location.pathname.split('/');
  const cIdx = parts.indexOf('c');
  return cIdx !== -1 ? parts[cIdx + 1] : null;
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

function buildShareUrl(c, provinciaDisplayName) {
  const params = new URLSearchParams({
    networkId: '1',
    networkName: 'Salud',
    ordination: 'Relevance',
    ordinationName: 'Relevancia',
    address: `${provinciaDisplayName || c.city || ''}, España`,
    provinceId: c.provinceCode || '',
  });
  if (c.lat && c.lon) { params.set('latitude', c.lat); params.set('longitude', c.lon); }
  return `${ASISA_SEARCH_PUBLIC}?${params}`;
}

function buildCitaUrl(c, speciality, provinciaDisplayName) {
  const params = new URLSearchParams({
    networkId: '1',
    networkName: 'Salud',
    ordination: 'Relevance',
    ordinationName: 'Relevancia',
    address: `${provinciaDisplayName || c.city || ''}, España`,
    provinceId: c.provinceCode || '',
    speciality: speciality || '',
    specialityName: speciality || '',
    specialityType: '1',
    fromPublicArea: 'true',
    concept: c.name,
  });
  if (c.lat && c.lon) { params.set('latitude', c.lat); params.set('longitude', c.lon); }
  return `${ASISA_SEARCH}?${params}`;
}

function renderBreadcrumb(c, provinciaDisplayName) {
  return `<nav class="cmp-breadcrumb" aria-label="Breadcrumb">
    <ol class="cmp-breadcrumb__list">
      <li class="cmp-breadcrumb__item"><a href="/" class="cmp-breadcrumb__item-link">Home</a></li>
      <li class="cmp-breadcrumb__item"><a href="/cuadro-medico" class="cmp-breadcrumb__item-link">Cuadro médico</a></li>
      <li class="cmp-breadcrumb__item"><a href="/cuadro-medico/p/${c.provinceSlug}" class="cmp-breadcrumb__item-link">${provinciaDisplayName}</a></li>
      <li class="cmp-breadcrumb__item cmp-breadcrumb__item--active">${formatName(c.name)}</li>
    </ol>
  </nav>`;
}

function renderHeader(c) {
  return `<div class="cmp-medical-detail__header">
    <p class="cmp-medical-detail__eyebrow">CUADRO MÉDICO ASISA</p>
    <div class="cmp-title">
      <h1 class="cmp-title__text">${formatName(c.name)}</h1>
    </div>
    ${c.description ? `<p class="cmp-medical-detail__description">${c.description}</p>` : ''}
  </div>`;
}

function renderTagRow(c) {
  const tags = ['<div class="cmp-medical-detail__title-block__tags--item"><div class="cmp-tag-template cmp-tag-template--blue"><div class="cmp-tag-template__text">CENTRO MÉDICO</div></div></div>'];
  if (c.businessGroup) {
    tags.push('<div class="cmp-tag-template cmp-tag-template--blank"><div class="cmp-tag-template__text">Centro de ASISA</div></div>');
  }
  return tags.join('');
}

function renderServiceTags(c) {
  const tags = [];
  if (c.onlineAppointment) tags.push('<div class="cmp-tag-template cmp-tag-template--blank"><div class="cmp-tag-template__text">Cita online</div></div>');
  if (c.videoConsultation) tags.push('<div class="cmp-tag-template cmp-tag-template--blank"><div class="cmp-tag-template__text">Videoconsulta</div></div>');
  if (c.ePrescription) tags.push('<div class="cmp-tag-template cmp-tag-template--blank"><div class="cmp-tag-template__text">Receta electrónica</div></div>');
  return tags.join('');
}

function renderMainCard(c, provinciaDisplayName) {
  const mapsUrl = (c.lat && c.lon) ? `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lon}` : '';
  const addressLine = [c.address, c.postalCode, c.city].filter(Boolean).join(', ');
  const shareUrl = buildShareUrl(c, provinciaDisplayName);

  return `<div class="cmp-medical-detail__first-block">
    <div class="cmp-medical-detail__title-block">
      <div class="cmp-medical-detail__title-block__tags">
        ${renderTagRow(c)}
        <a class="cmp-medical-detail__title-block__tags--share" href="${shareUrl}" target="_blank" rel="noopener">
          Compartir <i class="icon-share-01"></i>
        </a>
      </div>
      <div class="cmp-title">
        <h2 class="cmp-title__text">${formatName(c.name)}</h2>
      </div>
    </div>
    <div class="cmp-medical-detail__address-block">
      ${addressLine ? `<div class="cmp-medical-detail__address-block--name"><i class="icon-marker-02"></i>${formatName(addressLine)}</div>` : ''}
      <div class="cmp-medical-detail__address-block__location">
        ${mapsUrl ? `<div class="cmp-medical-detail__address-block__location--reach"><div class="button-cmp"><a href="${mapsUrl}" target="_blank" rel="noopener" class="btn button-cmp__text button-cmp__text--link button-location"><i class="icon-map-04 icon-large"></i>Cómo llegar</a></div></div>` : ''}
      </div>
      <div class="cmp-medical-detail__address-block__tags">${renderServiceTags(c)}</div>
    </div>
    ${c.phone ? `<div class="cmp-medical-detail__buttons-block">
      <div class="button-cmp"><a href="tel:${c.phone}" class="btn button-cmp__text button-cmp__text--link"><i class="icon-phone"></i>${c.phone}</a></div>
    </div>` : ''}
  </div>`;
}

function showsPedirCita(spec) {
  if (/urgenc/i.test(spec.speciality)) return false;
  return (spec.doctors && spec.doctors.length > 0) || !!spec.onlineAppointment;
}

function renderSpecAccordionItem(spec, c, provinciaDisplayName) {
  const docs = spec.doctors || [];
  const subs = spec.subSpecialities || [];
  const citaUrl = buildCitaUrl(c, spec.speciality, provinciaDisplayName);
  const ctaLabel = spec.onlineAppointment ? 'Pedir cita online' : 'Pedir cita';
  const phoneBlock = spec.phone ? `<div class="button-cmp"><a href="tel:${spec.phone}" class="btn button-cmp__text button-cmp__text--link"><i class="icon-phone"></i>${spec.phone}</a></div>` : '';
  const citaBlock = showsPedirCita(spec)
    ? `<div class="button-cmp"><a href="${citaUrl}" target="_blank" rel="noopener" class="btn button-cmp__text button-cmp__text--primary">${ctaLabel}</a></div>`
    : '';

  return `<div class="cm-fcentro__spec">
    <div class="cm-fcentro__spec-header">
      <h3 class="cm-fcentro__spec-title">${formatName(spec.speciality)}</h3>
      <div class="cm-fcentro__spec-actions">
        ${phoneBlock}
        ${citaBlock}
      </div>
    </div>
    <details class="cm-fcentro__spec-details">
      <summary class="cm-fcentro__spec-toggle">Ver más información <i class="icon-chevron-down"></i></summary>
      <div class="cm-fcentro__spec-body">
        <div class="cm-fcentro__spec-col">
          <h4 class="cm-fcentro__spec-col-title"><i class="icon-users-01"></i>Cuadro de especialistas</h4>
          ${docs.length ? `<ul class="cm-fcentro__spec-list">
            ${docs.map((d) => `<li><a href="/cuadro-medico/d/${d.key}">${formatName(d.name)}</a></li>`).join('')}
          </ul>` : '<p class="cm-fcentro__empty">—</p>'}
        </div>
        <div class="cm-fcentro__spec-col">
          <h4 class="cm-fcentro__spec-col-title"><i class="icon-medical-cross-01"></i>Subespecialidades</h4>
          ${subs.length ? `<ul class="cm-fcentro__spec-list">
            ${subs.map((s) => `<li>${formatName(s)}</li>`).join('')}
          </ul>` : '<p class="cm-fcentro__empty">—</p>'}
        </div>
        <div class="cm-fcentro__spec-col">
          <h4 class="cm-fcentro__spec-col-title"><i class="icon-info-circle"></i>Observaciones</h4>
          ${spec.observations ? `<p>${spec.observations}</p>` : '<p class="cm-fcentro__empty">—</p>'}
        </div>
      </div>
    </details>
  </div>`;
}

function renderSpecialitiesSection(c, provinciaDisplayName) {
  if (!c.specialities?.length) return '';
  return `<section class="cm-fcentro__specs-section">
    <h2 class="cmp-medical-detail__subtitle">Especialidades médicas del centro</h2>
    ${c.specialities.map((s) => renderSpecAccordionItem(s, c, provinciaDisplayName)).join('')}
  </section>`;
}

function renderDoctorCard(d) {
  return `<article class="cm-fcentro__doctor-card">
    <i class="icon-user-doctor cm-fcentro__doctor-icon" aria-hidden="true"></i>
    <h3 class="cm-fcentro__doctor-name">${formatPersonName(d.name)}</h3>
    ${d.speciality ? `<p class="cm-fcentro__doctor-spec">${formatName(d.speciality)}</p>` : ''}
    <a class="cm-fcentro__doctor-link" href="/cuadro-medico/d/${d.key}">Ver perfil</a>
  </article>`;
}

function renderDoctorsSection(c) {
  if (!c.doctors?.length) return '';
  return `<section class="cm-fcentro__doctors-section">
    <h2 class="cmp-medical-detail__subtitle">Médicos en ${formatName(c.name)}</h2>
    <div class="cm-fcentro__doctors-grid">
      ${c.doctors.map(renderDoctorCard).join('')}
    </div>
  </section>`;
}

function renderOtherCentroCard(oc) {
  const addressLine = [oc.address, oc.postalCode, oc.city].filter(Boolean).join('. ');
  const tagLabel = oc.providerType === 4 ? 'LABORATORIO' : 'CENTRO MÉDICO';
  const specTags = (oc.specialities || []).map((s) => `<div class="cmp-tag-template cmp-tag-template--blank"><div class="cmp-tag-template__text">${formatName(s)}</div></div>`).join('');
  const moreTag = oc.specialitiesMore > 0 ? `<div class="cmp-tag-template cmp-tag-template--blank"><div class="cmp-tag-template__text">+ ${oc.specialitiesMore}más</div></div>` : '';

  return `<div class="cmp-medical-detail__first-block cm-fcentro__other">
    <div class="cmp-medical-detail__title-block">
      <div class="cmp-medical-detail__title-block__tags">
        <div class="cmp-medical-detail__title-block__tags--item"><div class="cmp-tag-template cmp-tag-template--blue"><div class="cmp-tag-template__text">${tagLabel}</div></div></div>
        ${oc.businessGroup ? '<div class="cmp-tag-template cmp-tag-template--blank"><div class="cmp-tag-template__text">Centro de ASISA</div></div>' : ''}
      </div>
      <div class="cmp-title">
        <h3 class="cmp-title__text"><a href="/cuadro-medico/c/${oc.key}">${formatName(oc.name)}</a></h3>
      </div>
      ${addressLine ? `<div class="cmp-medical-detail__address-block--name"><i class="icon-marker-02"></i>${formatName(addressLine)}</div>` : ''}
      <div class="cmp-medical-detail__address-block__tags">${specTags}${moreTag}</div>
    </div>
    <div class="cmp-medical-detail__buttons-block">
      ${oc.phone ? `<div class="button-cmp"><a href="tel:${oc.phone}" class="btn button-cmp__text button-cmp__text--link"><i class="icon-phone"></i>${oc.phone}</a></div>` : ''}
      <div class="button-cmp"><a href="/cuadro-medico/c/${oc.key}" class="btn button-cmp__text button-cmp__text--primary">Ver detalle</a></div>
    </div>
  </div>`;
}

function renderOtherCentrosSection(c, provinciaDisplayName) {
  if (!c.otherCentros?.length) return '';
  return `<section class="cm-fcentro__other-section">
    <h2 class="cmp-medical-detail__subtitle">Otros centros ASISA con las mismas especialidades en ${provinciaDisplayName}</h2>
    <div class="cm-fcentro__other-grid">
      ${c.otherCentros.map(renderOtherCentroCard).join('')}
    </div>
  </section>`;
}

export default function decorate(block) {
  const key = getKeyFromUrl();
  if (!key) { block.hidden = true; return; }

  block.innerHTML = '<p>Cargando centro…</p>';

  Promise.all([
    fetch(`${API_BASE}/api/centro?key=${key}`).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
    fetch(`${API_BASE}/api/provincias`).then((r) => r.json()),
  ])
    .then(([c, provincias]) => {
      const provincia = provincias.find((p) => p.slug === c.provinceSlug);
      const provinciaDisplayName = provincia?.displayName || c.provinceSlug;

      block.innerHTML = `<div class="cmp-medical-detail">
        ${renderBreadcrumb(c, provinciaDisplayName)}
        ${renderHeader(c)}
        ${renderMainCard(c, provinciaDisplayName)}
        ${renderSpecialitiesSection(c, provinciaDisplayName)}
        ${renderDoctorsSection(c)}
        ${renderOtherCentrosSection(c, provinciaDisplayName)}
      </div>`;
    })
    .catch(() => {
      block.innerHTML = '<p>No se pudo cargar la ficha del centro.</p>';
    });
}
