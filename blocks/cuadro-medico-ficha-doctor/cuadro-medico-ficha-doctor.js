/**
 * Bloque "cuadro-medico-ficha-doctor".
 *
 * Ficha completa del médico. Lee la URL:  /cuadro-medico/d/{key}
 *
 * UI 100% con clases del design system ASISA (clientlib-site.min.css):
 *   - .cmp-medical-detail__first-block   → card principal
 *   - .cmp-medical-detail__title-block   → bloque de tags + nombre + colegiado + especialidad
 *   - .cmp-medical-detail__address-block → centro + dirección + Cómo llegar
 *   - .cmp-tag-template--blue / --blank  → etiquetas
 *   - .button-cmp / .btn                 → botones
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

function buildShareUrl(d, provinciaDisplayName) {
  const params = new URLSearchParams({
    networkId: '1', networkName: 'Salud',
    ordination: 'Relevance', ordinationName: 'Relevancia',
    address: `${provinciaDisplayName || d.city || ''}, España`,
    provinceId: d.provinceCode || '',
    speciality: d.specialities[0] || '',
    specialityName: d.specialities[0] || '',
    specialityType: '1',
  });
  if (d.lat && d.lon) { params.set('latitude', d.lat); params.set('longitude', d.lon); }
  return `${ASISA_SEARCH_PUBLIC}?${params}`;
}

function buildCitaUrl(d, provinciaDisplayName) {
  const params = new URLSearchParams({
    networkId: '1', networkName: 'Salud',
    ordination: 'Relevance', ordinationName: 'Relevancia',
    address: `${provinciaDisplayName || d.city || ''}, España`,
    provinceId: d.provinceCode || '',
    speciality: d.specialities[0] || '',
    specialityName: d.specialities[0] || '',
    specialityType: '1',
    fromPublicArea: 'true',
    concept: d.name,
  });
  if (d.lat && d.lon) { params.set('latitude', d.lat); params.set('longitude', d.lon); }
  return `${ASISA_SEARCH}?${params}`;
}

function renderTagRow(d) {
  const tags = [];
  tags.push('<div class="cmp-medical-detail__title-block__tags--item"><div class="cmp-tag-template cmp-tag-template--blue"><div class="cmp-tag-template__text">MÉDICO / PROFESIONAL</div></div></div>');
  if (d.businessGroup) {
    tags.push('<div class="cmp-tag-template cmp-tag-template--blank"><div class="cmp-tag-template__text">Centro de ASISA</div></div>');
  }
  return tags.join('');
}

function renderServiceTags(d) {
  const tags = [];
  if (d.onlineAppointment) tags.push('<div class="cmp-tag-template cmp-tag-template--blank"><div class="cmp-tag-template__text">Cita online</div></div>');
  if (d.videoConsultation) tags.push('<div class="cmp-tag-template cmp-tag-template--blank"><div class="cmp-tag-template__text">Videoconsulta</div></div>');
  if (d.ePrescription) tags.push('<div class="cmp-tag-template cmp-tag-template--blank"><div class="cmp-tag-template__text">Receta electrónica</div></div>');
  (d.languages || []).forEach((l) => {
    tags.push(`<div class="cmp-tag-template cmp-tag-template--blank"><div class="cmp-tag-template__text">${l}</div></div>`);
  });
  return tags.join('');
}

function renderMainCard(d, provinciaDisplayName) {
  const mapsUrl = (d.lat && d.lon) ? `https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lon}` : '';
  const addressLine = [d.address, d.postalCode, d.city].filter(Boolean).join(', ');
  const shareUrl = buildShareUrl(d, provinciaDisplayName);
  const center = d.parentDescription ? formatName(d.parentDescription) : '';
  const speciality = formatName(d.specialities?.[0] || '');

  return `<div class="cmp-medical-detail__first-block">
    <div class="cmp-medical-detail__title-block">
      <div class="cmp-medical-detail__title-block__tags">
        ${renderTagRow(d)}
        <a class="cmp-medical-detail__title-block__tags--share" href="${shareUrl}" target="_blank" rel="noopener">
          Compartir <i class="icon-share-01"></i>
        </a>
      </div>
      <p class="cmp-medical-detail__title-block--speciality">${speciality}</p>
      <div class="cmp-title">
        <h1 class="cmp-title__text">${formatPersonName(d.name)}</h1>
      </div>
      ${d.collegiateCode ? `<p class="cmp-medical-detail__title-block--num-member"><em>Núm. Colegiado – ${d.collegiateCode}</em></p>` : ''}
    </div>
    <div class="cmp-medical-detail__address-block">
      ${center ? `<div class="cmp-medical-detail__address-block--center">${center}</div>` : ''}
      ${addressLine ? `<div class="cmp-medical-detail__address-block--name"><i class="icon-marker-02"></i>${formatName(addressLine)}</div>` : ''}
      <div class="cmp-medical-detail__address-block__location">
        ${mapsUrl ? `<div class="cmp-medical-detail__address-block__location--reach"><div class="button-cmp"><a href="${mapsUrl}" target="_blank" rel="noopener" class="btn button-cmp__text button-cmp__text--link button-location"><i class="icon-map-04 icon-large"></i>Cómo llegar</a></div></div>` : ''}
      </div>
      <div class="cmp-medical-detail__address-block__tags">${renderServiceTags(d)}</div>
    </div>
    ${d.phone ? `<div class="cmp-medical-detail__buttons-block">
      <div class="button-cmp"><a href="tel:${d.phone}" class="btn button-cmp__text button-cmp__text--link"><i class="icon-phone"></i>${d.phone}</a></div>
    </div>` : ''}
  </div>`;
}

function renderSpecCard(d, speciality, phone, online, provinciaDisplayName) {
  const citaUrl = buildCitaUrl({ ...d, phone, onlineAppointment: online }, provinciaDisplayName);
  const ctaLabel = online ? 'Pedir cita online' : 'Pedir cita';

  return `<div class="cmp-medical-detail__first-block cmp-medical-detail--blue">
    <div class="cmp-medical-detail__title-block">
      <div class="cmp-title">
        <h2 class="cmp-title__text">${speciality}</h2>
      </div>
    </div>
    <div class="cmp-medical-detail__buttons-block">
      ${phone ? `<div class="button-cmp"><a href="tel:${phone}" class="btn button-cmp__text button-cmp__text--link"><i class="icon-phone"></i>${phone}</a></div>` : ''}
      <div class="button-cmp"><a href="${citaUrl}" target="_blank" rel="noopener" class="btn button-cmp__text button-cmp__text--primary">${ctaLabel}</a></div>
    </div>
  </div>`;
}

function renderOtherLocationCard(loc) {
  const mapsUrl = (loc.lat && loc.lon) ? `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lon}` : '';
  const addressLine = [loc.address, loc.postalCode, loc.city].filter(Boolean).join(', ');
  const centerName = loc.parentDescription ? formatName(loc.parentDescription) : formatName(loc.name || '');
  const tags = [];
  if (loc.onlineAppointment) tags.push('<div class="cmp-tag-template cmp-tag-template--blank"><div class="cmp-tag-template__text">Cita online</div></div>');
  if (loc.videoConsultation) tags.push('<div class="cmp-tag-template cmp-tag-template--blank"><div class="cmp-tag-template__text">Videoconsulta</div></div>');
  if (loc.ePrescription) tags.push('<div class="cmp-tag-template cmp-tag-template--blank"><div class="cmp-tag-template__text">Receta electrónica</div></div>');

  return `<div class="cmp-medical-detail__first-block">
    <div class="cmp-medical-detail__title-block">
      <div class="cmp-medical-detail__title-block__tags">
        <div class="cmp-medical-detail__title-block__tags--item">
          <div class="cmp-tag-template cmp-tag-template--blue">
            <div class="cmp-tag-template__text">CENTRO MÉDICO</div>
          </div>
        </div>
      </div>
      <div class="cmp-title">
        <h3 class="cmp-title__text">${centerName}</h3>
      </div>
    </div>
    <div class="cmp-medical-detail__address-block">
      ${addressLine ? `<div class="cmp-medical-detail__address-block--name"><i class="icon-marker-02"></i>${formatName(addressLine)}</div>` : ''}
      <div class="cmp-medical-detail__address-block__location">
        ${mapsUrl ? `<div class="cmp-medical-detail__address-block__location--reach"><div class="button-cmp"><a href="${mapsUrl}" target="_blank" rel="noopener" class="btn button-cmp__text button-cmp__text--link button-location"><i class="icon-map-04 icon-large"></i>Cómo llegar</a></div></div>` : ''}
      </div>
      ${tags.length ? `<div class="cmp-medical-detail__address-block__tags">${tags.join('')}</div>` : ''}
    </div>
    ${loc.phone ? `<div class="cmp-medical-detail__buttons-block">
      <div class="button-cmp"><a href="tel:${loc.phone}" class="btn button-cmp__text button-cmp__text--link"><i class="icon-phone"></i>${loc.phone}</a></div>
    </div>` : ''}
  </div>`;
}

function renderOtherLocations(d, provinciaDisplayName) {
  if (!d.otherLocations?.length) return '';
  const docName = formatPersonName(d.name);
  const sections = d.otherLocations.map((loc) => `${renderOtherLocationCard(loc)}${renderSpecCard(d, formatName(loc.speciality || d.specialities?.[0] || ''), loc.phone, loc.onlineAppointment, provinciaDisplayName)}`).join('');
  return `<h2 class="cmp-medical-detail__subtitle">${docName} también trabaja en estos centros</h2>${sections}`;
}

export default function decorate(block) {
  const key = getKeyFromUrl();
  if (!key) { block.hidden = true; return; }

  block.innerHTML = '<p>Cargando médico…</p>';

  const demo = new URLSearchParams(window.location.search).get('demo') === '1' ? '&demo=1' : '';

  Promise.all([
    fetch(`${API_BASE}/api/doctor?key=${key}${demo}`).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
    fetch(`${API_BASE}/api/provincias`).then((r) => r.json()),
  ])
    .then(([d, provincias]) => {
      const provincia = provincias.find((p) => p.slug === d.provinceSlug);
      const provinciaDisplayName = provincia?.displayName || d.provinceSlug;

      const mainSpec = formatName(d.specialities?.[0] || '');
      block.innerHTML = `<div class="cmp-medical-detail">
        ${renderMainCard(d, provinciaDisplayName)}
        ${renderSpecCard(d, mainSpec, d.phone, d.onlineAppointment, provinciaDisplayName)}
        ${renderOtherLocations(d, provinciaDisplayName)}
      </div>`;
    })
    .catch(() => {
      block.innerHTML = '<p>No se pudo cargar la ficha del médico.</p>';
    });
}
