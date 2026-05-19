/**
 * Bloque EDS "cuadro-medico".
 *
 * Render dinámico desde URL (BYOM). Lee window.location.pathname:
 *   /cuadro-medico/p/<prov>            → todos los providers de la provincia
 *   /cuadro-medico/p/<prov>/pe/<spec>  → providers filtrados por especialidad
 *
 * UI 100% con clases del design system de ASISA (clientlib-site.min.css):
 *   - .cmp-medical-picture-result__*  → wrapper, header
 *   - .cmp-tabs__*                    → tabs Profesionales / Centros
 *   - .cmp-medical-detail__*          → tarjeta de cada provider
 *   - .cmp-tag-template--*            → etiquetas
 *   - .button-cmp / .btn              → botones
 *
 * No añade CSS propio.
 */

const API_BASE = 'https://asisa-pc.vercel.app';
const ASISA_SEARCH = 'https://www.asisa.es/cuadro-medico/resultados-cuadro-medico';
const ASISA_SEARCH_PRIVATE = 'https://www.asisa.es/asegurado/salud/cuadro-medico/resultados-cuadro-medico';
const PAGE_SIZE = 20;

function getSlugsFromUrl() {
  const parts = window.location.pathname.split('/');
  const pIdx = parts.indexOf('p');
  const peIdx = parts.indexOf('pe');
  return {
    provSlug: pIdx !== -1 ? parts[pIdx + 1] : null,
    specSlug: peIdx !== -1 ? parts[peIdx + 1] : null,
  };
}

function buildShareUrl(provinceCode, locationName, speciality, lat, lon) {
  const params = new URLSearchParams({
    networkId: '1', networkName: 'Salud',
    ordination: 'Relevance', ordinationName: 'Relevancia',
    address: `${locationName}, España`,
    provinceId: provinceCode,
    speciality, specialityName: speciality,
    specialityType: '1',
  });
  if (lat && lon) { params.set('latitude', lat); params.set('longitude', lon); }
  return `${ASISA_SEARCH}?${params}`;
}

function buildCitaUrl(provinceCode, locationName, speciality, lat, lon, concept) {
  const params = new URLSearchParams({
    networkId: '1', networkName: 'Salud',
    ordination: 'Relevance', ordinationName: 'Relevancia',
    address: `${locationName}, España`,
    provinceId: provinceCode,
    speciality, specialityName: speciality,
    specialityType: '1',
    fromPublicArea: 'true',
    concept,
  });
  if (lat && lon) { params.set('latitude', lat); params.set('longitude', lon); }
  return `${ASISA_SEARCH_PRIVATE}?${params}`;
}

function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 4) return phone || '';
  return `${digits.slice(0, 1)}X XXX XXX`;
}

function formatName(name) {
  if (!name) return '';
  return name.toLowerCase().split(/(\s+)/).map((w) => (w && /\S/.test(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join('');
}

function formatPersonName(name) {
  if (!name) return '';
  // Provider DB stores "APELLIDOS, NOMBRE" — reorder to "Nombre Apellidos"
  const parts = name.split(',');
  const ordered = parts.length === 2 ? `${parts[1].trim()} ${parts[0].trim()}` : name;
  const formatted = formatName(ordered);
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

function renderCard(p, isProfessional, provinceCode, locationName) {
  const displayName = isProfessional
    ? formatPersonName(p.name)
    : formatName(p.name);
  const speciality = formatName(p.speciality || '');
  const fullAddress = [p.address, p.postalCode, p.city].filter(Boolean).join(', ');
  const formattedAddress = formatName(fullAddress);
  const mapsUrl = (p.lat && p.lon) ? `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}` : '';
  const masked = maskPhone(p.phone);
  const langTags = (p.languages || [])
    .map((l) => `<div class="cmp-tag-template cmp-tag-template--blank"><div class="cmp-tag-template__text">${l}</div></div>`)
    .join('');
  const citaUrl = buildCitaUrl(provinceCode, locationName, p.speciality, p.lat, p.lon, p.name);
  const detailUrl = p.detailUrl || '#';

  return `<div class="cmp-medical-detail__first-block">
    <div class="cmp-medical-detail__title-block">
      <div class="cmp-medical-detail__title-block__tags">
        <div class="cmp-medical-detail__title-block__tags--item">
          <div class="cmp-tag-template cmp-tag-template--blue">
            <div class="cmp-tag-template__text">${getProviderTag(p)}</div>
          </div>
        </div>
        ${p.businessGroup ? '<div class="cmp-tag-template cmp-tag-template--blank"><div class="cmp-tag-template__text">Centro de ASISA</div></div>' : ''}
        ${p.ePrescription ? '<div class="cmp-tag-template cmp-tag-template--blank"><div class="cmp-tag-template__text">Receta electrónica</div></div>' : ''}
        ${p.onlineAppointment ? '<div class="cmp-tag-template cmp-tag-template--blank"><div class="cmp-tag-template__text">Cita online</div></div>' : ''}
        ${langTags}
      </div>
      <div class="cmp-title">
        <h3 class="cmp-title__text">${displayName}</h3>
      </div>
      ${(isProfessional && p.collegiateCode) ? `<p class="cmp-medical-detail__title-block--num-member"><em>Núm. Colegiado – ${p.collegiateCode}</em></p>` : ''}
      <p class="cmp-medical-detail__title-block--speciality">${speciality}</p>
    </div>
    <div class="cmp-medical-detail__address-block">
      ${p.parentDescription ? `<div class="cmp-medical-detail__address-block--center">${formatName(p.parentDescription)}</div>` : ''}
      ${formattedAddress ? `<div class="cmp-medical-detail__address-block--name"><i class="icon-marker-02"></i>${formattedAddress}</div>` : ''}
      <div class="cmp-medical-detail__address-block__location">
        ${mapsUrl ? `<div class="cmp-medical-detail__address-block__location--reach"><div class="button-cmp"><a href="${mapsUrl}" target="_blank" rel="noopener" class="btn button-cmp__text button-cmp__text--link button-location"><i class="icon-map-04 icon-large"></i>Cómo llegar</a></div></div>` : ''}
        ${p.phone ? `<div class="cmp-medical-detail__address-block__location--reach"><div class="button-cmp"><a href="tel:${p.phone}" class="btn button-cmp__text button-cmp__text--link button-location"><i class="icon-phone"></i>${masked}</a></div></div>` : ''}
      </div>
    </div>
    <div class="cmp-medical-detail__buttons-block">
      ${p.onlineAppointment ? `<div class="button-cmp"><a href="${citaUrl}" target="_blank" rel="noopener" class="btn button-cmp__text button-cmp__text--tertiary">Pedir cita</a></div>` : ''}
      <div class="button-cmp"><a href="${detailUrl}" class="btn button-cmp__text button-cmp__text--primary">Ver detalle</a></div>
    </div>
  </div>`;
}

function renderPagination(currentPage, totalPages) {
  if (totalPages <= 1) return '';
  const items = [];
  const prev = currentPage > 1 ? currentPage - 1 : null;
  const next = currentPage < totalPages ? currentPage + 1 : null;
  items.push(`<div class="button-cmp"><button class="btn button-cmp__text button-cmp__text--link" data-page="${prev || ''}" ${prev ? '' : 'disabled'}><i class="icon-chevron-left"></i></button></div>`);

  const pages = new Set([1, totalPages, currentPage]);
  for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i += 1) pages.add(i);
  const sorted = [...pages].sort((a, b) => a - b);
  let prevNum = 0;
  sorted.forEach((n) => {
    if (n - prevNum > 1) items.push('<span>…</span>');
    const active = n === currentPage ? 'button-cmp__text--primary' : 'button-cmp__text--link';
    items.push(`<div class="button-cmp"><button class="btn button-cmp__text ${active}" data-page="${n}">${n}</button></div>`);
    prevNum = n;
  });

  items.push(`<div class="button-cmp"><button class="btn button-cmp__text button-cmp__text--link" data-page="${next || ''}" ${next ? '' : 'disabled'}><i class="icon-chevron-right"></i></button></div>`);

  return `<div class="cmp-medical-picture-result__pagination">${items.join('')}</div>`;
}

function renderShell(state) {
  const {
    locationName, provinceCode, specName,
    totalProfessionals, totalCenters,
    tab, page, totalPages, total, results,
    loading,
  } = state;

  const shareUrl = results[0]
    ? buildShareUrl(provinceCode, locationName, results[0].speciality || specName || '', results[0].lat, results[0].lon)
    : '';

  const titleText = specName
    ? `${total} resultados en <strong>${locationName}</strong> — ${specName}`
    : `${total} resultados en <strong>${locationName}</strong>`;

  const header = `<div class="cmp-medical-picture-result__header">
    <div class="cmp-medical-picture-result__header--share-title-block">
      <div class="cmp-medical-picture-result__header--title">${titleText}</div>
      ${shareUrl ? `<a class="cmp-medical-picture-result__header--share" href="${shareUrl}" target="_blank" rel="noopener"><i class="icon-share"></i>Compartir</a>` : ''}
    </div>
  </div>`;

  const tabs = `<div class="cmp-tabs">
    <ul class="cmp-tabs__tablist">
      <li class="cmp-tabs__tab${tab === 'professionals' ? ' cmp-tabs__tab--active active' : ''}" data-tab="professionals">Profesionales (${totalProfessionals})</li>
      <li class="cmp-tabs__tab${tab === 'centers' ? ' cmp-tabs__tab--active active' : ''}" data-tab="centers">Centros médicos (${totalCenters})</li>
    </ul>
    <div class="cmp-tabs__tabpanel">
      ${loading
    ? '<div class="cmp-medical-picture-result__loading">Cargando…</div>'
    : `<div class="cmp-medical-detail">${results.map((p) => renderCard(p, tab === 'professionals', provinceCode, locationName)).join('')}</div>`}
      ${renderPagination(page, totalPages)}
    </div>
  </div>`;

  return `${header}${tabs}`;
}

async function fetchPage(provSlug, specSlug, tab, page) {
  const params = new URLSearchParams({ provinceSlug: provSlug, tab, page: String(page), limit: String(PAGE_SIZE) });
  if (specSlug) params.set('specSlug', specSlug);
  const [provincia, providersResp] = await Promise.all([
    fetch(`${API_BASE}/api/provincias?slug=${provSlug}`).then((r) => r.json()),
    fetch(`${API_BASE}/api/providers?${params}`).then((r) => r.json()),
  ]);
  return { provincia, providersResp };
}

function attachListeners(block, state, refresh) {
  block.querySelectorAll('.cmp-tabs__tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const newTab = btn.dataset.tab;
      if (newTab && newTab !== state.tab) refresh({ ...state, tab: newTab, page: 1 });
    });
  });
  block.querySelectorAll('[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = parseInt(btn.dataset.page, 10);
      if (p && p !== state.page) {
        refresh({ ...state, page: p });
        block.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

async function decorate(block) {
  const { provSlug, specSlug } = getSlugsFromUrl();
  if (!provSlug) { block.hidden = true; return; }
  block.classList.add('cmp-medical-picture-result');

  let state = { tab: 'professionals', page: 1, loading: true, results: [] };
  block.innerHTML = '<div class="cmp-medical-picture-result__loading">Cargando médicos…</div>';

  async function refresh(next) {
    state = { ...state, ...next, loading: true };
    block.innerHTML = renderShell(state);
    try {
      const { provincia, providersResp } = await fetchPage(provSlug, specSlug, state.tab, state.page);
      state = {
        ...state,
        loading: false,
        locationName: provincia?.displayName || provSlug,
        provinceCode: provincia?.provinceCode || '',
        specName: specSlug ? specSlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '',
        totalProfessionals: providersResp.totalProfessionals || 0,
        totalCenters: providersResp.totalCenters || 0,
        page: providersResp.page,
        totalPages: providersResp.totalPages || 1,
        total: providersResp.total || 0,
        results: providersResp.results || [],
      };
      if (!state.total && !state.totalProfessionals && !state.totalCenters) {
        block.hidden = true;
        return;
      }
      block.innerHTML = renderShell(state);
      attachListeners(block, state, refresh);
    } catch (e) {
      block.innerHTML = '<div class="cmp-medical-picture-result__error">No se pudieron cargar los resultados.</div>';
    }
  }

  refresh(state);
}

export default decorate;
