/**
 * Bloque EDS "cuadro-medico".
 *
 * Render dinámico desde URL (BYOM):
 *   /cuadro-medico/p/<prov>            → todos los providers de la provincia
 *   /cuadro-medico/p/<prov>/pe/<spec>  → providers filtrados por especialidad
 *   /cuadro-medico/e/<spec>            → fallback (especialidad sin provincia: oculto)
 *
 * UI:
 *  - Tabs Profesionales (N) / Centros médicos (N)
 *  - Grid 2 columnas
 *  - Paginación
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

function namePrefix(name) {
  if (!name) return '';
  // Heuristic: if first given name (after comma) ends in 'a' or matches feminine markers → Dra.
  // Spanish providers are typically "APELLIDOS, NOMBRE"
  const parts = name.split(',');
  const given = (parts[1] || parts[0] || '').trim().split(/\s+/)[0] || '';
  const femEndings = /a$/i;
  return femEndings.test(given) ? 'Dra.' : 'Dr.';
}

function formatName(name) {
  if (!name) return '';
  // Title case each space-separated word. Avoid regex `\w` because it
  // doesn't match accented chars and would re-capitalise letters after
  // an accent (e.g. "alergologÍa" → "AlergologíA").
  return name.toLowerCase().split(/(\s+)/).map((w) => (w && /\S/.test(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join('');
}

function getProviderTag(p) {
  if (String(p.doctorType) === '1') return 'MÉDICO/PROFESIONAL';
  if (String(p.providerType) === '3') return 'HOSPITAL';
  if (String(p.providerType) === '4') return 'CENTRO MÉDICO';
  if (String(p.providerType) === '8') return 'LABORATORIO';
  if (String(p.providerType) === '2') return 'TRANSPORTE SANITARIO';
  if (String(p.providerType) === '9') return 'OXIGENOTERAPIA';
  return 'PROVEEDOR';
}

function renderCard(p, isProfessional, provinceCode, locationName) {
  const formatted = isProfessional ? `${namePrefix(p.name)} ${formatName(p.name.replace(/(.+),\s*(.+)/, '$2 $1'))}` : formatName(p.name);
  const speciality = formatName(p.speciality || '');
  const fullAddress = [p.address, p.postalCode, p.city].filter(Boolean).join(', ');
  const formattedAddress = formatName(fullAddress);
  const mapsUrl = (p.lat && p.lon) ? `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}` : '';
  const masked = maskPhone(p.phone);
  const langTags = (p.languages || []).map((l) => `<span class="cm-lang">${l}</span>`).join('');
  const citaUrl = buildCitaUrl(provinceCode, locationName, p.speciality, p.lat, p.lon, p.name);
  const detailUrl = p.detailUrl || '#';
  const tag = getProviderTag(p);
  const businessGroup = p.businessGroup ? '<span class="cm-card-chip cm-card-chip--asisa">Centro de ASISA</span>' : '';

  return `<article class="cm-card">
    <div class="cm-card-body">
      <div class="cm-card-tags">
        <span class="cm-card-tag">${tag}</span>
        ${businessGroup}
      </div>
      <h3 class="cm-card-name">${formatted}</h3>
      <p class="cm-card-spec">${speciality}</p>
      ${p.parentDescription ? `<p class="cm-card-center">${formatName(p.parentDescription)}</p>` : ''}
      ${formattedAddress ? `<p class="cm-card-addr"><i class="icon-marker-02"></i> ${formattedAddress}</p>` : ''}
      <div class="cm-card-meta">
        ${mapsUrl ? `<a class="cm-card-meta-link" href="${mapsUrl}" target="_blank" rel="noopener"><i class="icon-map-04"></i> Cómo llegar</a>` : ''}
        ${p.phone ? `<a class="cm-card-meta-link" href="tel:${p.phone}"><i class="icon-phone"></i> ${masked}</a>` : ''}
      </div>
    </div>
    <div class="cm-card-side">
      <div class="cm-card-side-tags">
        ${p.onlineAppointment ? '<span class="cm-card-chip cm-card-chip--blank">Cita online</span>' : ''}
        ${langTags}
      </div>
      <div class="cm-card-buttons">
        ${p.onlineAppointment ? `<a class="btn btn--outline" href="${citaUrl}" target="_blank" rel="noopener">Pedir cita</a>` : ''}
        <a class="btn btn--primary" href="${detailUrl}">Ver detalle</a>
      </div>
    </div>
  </article>`;
}

function renderPagination(currentPage, totalPages) {
  if (totalPages <= 1) return '';
  const items = [];
  const prev = currentPage > 1 ? currentPage - 1 : null;
  const next = currentPage < totalPages ? currentPage + 1 : null;

  items.push(`<button class="cm-page cm-page--prev" data-page="${prev || ''}" ${prev ? '' : 'disabled'}>‹</button>`);

  // Show first, current ±2, last
  const pages = new Set([1, totalPages, currentPage]);
  for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i += 1) pages.add(i);
  const sorted = [...pages].sort((a, b) => a - b);
  let prevNum = 0;
  sorted.forEach((n) => {
    if (n - prevNum > 1) items.push('<span class="cm-page-ellipsis">…</span>');
    items.push(`<button class="cm-page${n === currentPage ? ' cm-page--current' : ''}" data-page="${n}">${n}</button>`);
    prevNum = n;
  });

  items.push(`<button class="cm-page cm-page--next" data-page="${next || ''}" ${next ? '' : 'disabled'}>›</button>`);

  return `<nav class="cm-pagination">${items.join('')}</nav>`;
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

  const title = specName
    ? `${total} resultados en <strong>${locationName}</strong> — ${specName}`
    : `${total} resultados en <strong>${locationName}</strong>`;

  const tabsHtml = `<div class="cm-tabs">
    <button class="cm-tab${tab === 'professionals' ? ' cm-tab--active' : ''}" data-tab="professionals">Profesionales (${totalProfessionals})</button>
    <button class="cm-tab${tab === 'centers' ? ' cm-tab--active' : ''}" data-tab="centers">Centros médicos (${totalCenters})</button>
  </div>`;

  const header = `<div class="cm-header">
    <div class="cm-header-title">${title}</div>
    ${shareUrl ? `<a class="cm-share" href="${shareUrl}" target="_blank" rel="noopener"><i class="icon-share"></i> Compartir</a>` : ''}
  </div>`;

  const grid = loading
    ? '<p class="cm-loading">Cargando…</p>'
    : `<div class="cm-grid">${results.map((p) => renderCard(p, tab === 'professionals', provinceCode, locationName)).join('')}</div>`;

  const pagination = renderPagination(page, totalPages);

  return `${header}${tabsHtml}${grid}${pagination}`;
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
  block.querySelectorAll('.cm-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const newTab = btn.dataset.tab;
      if (newTab && newTab !== state.tab) refresh({ ...state, tab: newTab, page: 1 });
    });
  });
  block.querySelectorAll('.cm-page').forEach((btn) => {
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

  let state = { tab: 'professionals', page: 1, loading: true, results: [] };
  block.innerHTML = '<p class="cm-loading">Cargando médicos…</p>';

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
      block.innerHTML = '<p class="cm-error">No se pudieron cargar los resultados.</p>';
    }
  }

  refresh(state);
}

export default decorate;
