/**
 * Bloque EDS "cuadro-medico".
 *
 * Renderiza tarjetas de proveedores agrupadas por especialidad.
 *
 * Estructura esperada (filas de tabla AEM):
 *  Fila 0: [locationName, provinceCode, totalProviders]
 *  Filas 1-N: [name, speciality, address, city, phone, lat, lon,
 *              doctorType, providerType, businessGroup, collegiateCode,
 *              parentDescription, postalCode, ePrescription, onlineAppointment, languages]
 */

const ASISA_SEARCH = 'https://www.asisa.es/cuadro-medico/resultados-cuadro-medico';
const ASISA_SEARCH_PRIVATE = 'https://www.asisa.es/asegurado/salud/cuadro-medico/resultados-cuadro-medico';

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

function getProviderType(p) {
  if (p.doctorType === '1') return { label: 'MÉDICO / PROFESIONAL', cls: 'cmp-tag-template--blue' };
  if (p.providerType === '3') return { label: 'HOSPITAL', cls: 'cmp-tag-template--blue' };
  if (p.providerType === '4') return { label: 'CENTRO MÉDICO', cls: 'cmp-tag-template--blue' };
  if (p.providerType === '8') return { label: 'LABORATORIO', cls: 'cmp-tag-template--blue' };
  if (p.providerType === '2') return { label: 'TRANSPORTE SANITARIO', cls: 'cmp-tag-template--blue' };
  if (p.providerType === '9') return { label: 'OXIGENOTERAPIA', cls: 'cmp-tag-template--blue' };
  return { label: 'PROVEEDOR', cls: 'type-cmp-tag-template--blue' };
}

function renderCard(p, provinceCode, locationName) {
  const type = getProviderType(p);
  const fullAddress = [p.address, p.postalCode, p.city].filter(Boolean).join(', ');
  const mapsUrl = (p.lat && p.lon)
    ? `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`
    : '';
  const langTags = p.languages.map((l) => `<span class="cm-tag tag-lang">${l}</span>`).join('');
  const citaUrl = buildCitaUrl(provinceCode, locationName, p.speciality, p.lat, p.lon, p.name);

  return `<div class="cmp-medical-detail__first-block">


    <div class="cmp-medical-detail__title-block">
      <div class="cmp-medical-detail__title-block__tags">
       <div class="cmp-medical-detail__title-block__tags--item ${type.cls}">
        <div class="cmp-tag-template__text">
            ${type.label}
        </div>
       </div>
       ${p.businessGroup ? '<div class="cmp-tag-template cmp-tag-template--blank"><div class="cmp-tag-template__text">Centro de ASISA</div></div>' : ''}

          ${p.ePrescription ? '<div class="cmp-tag-template cmp-tag-template--blank"><div class="cmp-tag-template__text">Receta electrónica</div></div>' : ''}
          ${langTags}
          ${p.onlineAppointment ? '<div class="cmp-tag-template cmp-tag-template--blank"><div class="cmp-tag-template__text">Cita online</div></div>' : ''}

      </div>
      <div class="cmp-title">
          <h3 class="cmp-title__text">${p.name}</h3>
      </div>
       ${p.collegiateCode ? `<p class="cmp-medical-detail__title-block--num-member"><em>Núm. Colegiado – ${p.collegiateCode}</em></p>` : ''}
        <p class="cmp-medical-detail__title-block--speciality">${p.speciality}</p>
    </div>
    <div class="cmp-medical-detail__address-block">
      ${p.parentDescription ? `<div class="cmp-medical-detail__address-block--center">${p.parentDescription}</div>` : ''}
      ${fullAddress ? `<div class="cmp-medical-detail__address-block--name"><i class="icon-marker-02"></i>${fullAddress}</div>` : ''}

      <div class="cmp-medical-detail__address-block__location">
          ${mapsUrl ? `<div class="cmp-medical-detail__address-block__location--reach"><div class="button-cmp"><a href="${mapsUrl}" target="_blank" rel="noopener" class="btn button-cmp__text button-cmp__text--link button-location"><i class="icon-map-04 icon-large"></i>Cómo llegar</a></div></div>` : ''}
          ${p.phone ? `<div class="cmp-medical-detail__address-block__location--reach"><div class="button-cmp"><a href="tel:${p.phone}" class="btn button-cmp__text button-cmp__text--link button-location"><i class="icon-phone"></i>${p.phone}</a></div></div>` : ''}
    </div>
    </div>

    <div class="cmp-medical-detail__buttons-block">
      <div class="button-cmp"><button class="btn button-cmp__text button-cmp__text--tertiary">Ver Detalle</button></div>
      ${p.onlineAppointment ? `<div class="button-cmp"><a href="${citaUrl}" target="_blank" rel="noopener" class="btn button-cmp__text button-cmp__text--primary">Pedir Cita</a></div>` : ''}
    </div>
  </div>`;
}

function renderResults(block, locationName, provinceCode, providers) {
  const firstWithCoords = providers.find((p) => p.lat && p.lon);
  const shareLat = firstWithCoords?.lat || '';
  const shareLon = firstWithCoords?.lon || '';
  const shareSpec = providers[0]?.speciality || '';
  const shareUrl = (provinceCode && shareSpec)
    ? buildShareUrl(provinceCode, locationName, shareSpec, shareLat, shareLon)
    : '';

  const groups = new Map();
  providers.forEach((p) => {
    const spec = p.speciality || 'Otros';
    if (!groups.has(spec)) groups.set(spec, []);
    groups.get(spec).push(p);
  });

  const shareBtn = shareUrl
    ? `<div class="button-cmp"><a href="${shareUrl}" target="_blank" rel="noopener" class="btn button-cmp__text button-cmp__text--link"><i class="icon-share"></i>Compartir</a></div>`
    : '';

  let html = `<div class="cmp-medical-picture-result__header"><div class="cmp-medical-picture-result__header--share-title-block"><div class="cmp-medical-picture-result__header--title">${providers.length} resultados en <strong>${locationName}</strong></div>${shareBtn}</div></div>`;

  groups.forEach((specProviders, specName) => {
    html += `<div class="cmp-medical-detail"><h2 class="cmp-medical-detail__subtitle">${specName}</h2>${specProviders.map((p) => renderCard(p, provinceCode, locationName)).join('')}</div>`;
  });

  block.innerHTML = html;
}

function getSlugsFromUrl() {
  const parts = window.location.pathname.split('/');
  const pIdx = parts.indexOf('p');
  const peIdx = parts.indexOf('pe');
  const eIdx = parts.indexOf('e');
  return {
    provSlug: pIdx !== -1 ? parts[pIdx + 1] : null,
    specSlug: peIdx !== -1 ? parts[peIdx + 1] : (eIdx !== -1 ? parts[eIdx + 1] : null),
  };
}

async function fetchAndRender(block) {
  const { provSlug, specSlug } = getSlugsFromUrl();
  if (!provSlug || !specSlug) { block.hidden = true; return; }

  block.innerHTML = '<p class="cm-loading">Cargando médicos…</p>';
  try {
    const [provincia, providersResp] = await Promise.all([
      fetch(`https://asisa-pc.vercel.app/api/provincias?slug=${provSlug}`).then((r) => r.json()),
      fetch(`https://asisa-pc.vercel.app/api/providers?provinceSlug=${provSlug}&specSlug=${specSlug}&limit=50`).then((r) => r.json()),
    ]);
    const locationName = provincia?.displayName || provSlug;
    const provinceCode = provincia?.provinceCode || provincia?.code || '';
    const providers = (providersResp?.results || []).map((p) => ({
      ...p,
      lat: p.lat ? String(p.lat) : '',
      lon: p.lon ? String(p.lon) : '',
      doctorType: p.doctorType != null ? String(p.doctorType) : '',
      providerType: p.providerType != null ? String(p.providerType) : '',
      languages: p.languages || [],
    }));
    if (!providers.length) { block.hidden = true; return; }
    renderResults(block, locationName, provinceCode, providers);
  } catch (e) {
    block.hidden = true;
  }
}

export default function decorate(block) {
  const rows = [...block.children];

  // BYOM / dynamic URL mode: no pre-populated rows → fetch from URL
  if (rows.length < 2) {
    fetchAndRender(block);
    return;
  }

  const locationName = rows[0]?.children[0]?.textContent?.trim() || '';
  const provinceCode = rows[0]?.children[1]?.textContent?.trim() || '';

  const providers = [];
  for (let i = 1; i < rows.length; i += 1) {
    const cells = rows[i]?.children || [];
    providers.push({
      name: cells[0]?.textContent?.trim() || '',
      speciality: cells[1]?.textContent?.trim() || '',
      address: cells[2]?.textContent?.trim() || '',
      city: cells[3]?.textContent?.trim() || '',
      phone: cells[4]?.textContent?.trim() || '',
      lat: cells[5]?.textContent?.trim() || '',
      lon: cells[6]?.textContent?.trim() || '',
      doctorType: cells[7]?.textContent?.trim() || '',
      providerType: cells[8]?.textContent?.trim() || '',
      businessGroup: cells[9]?.textContent?.trim() === '1',
      collegiateCode: cells[10]?.textContent?.trim() || '',
      parentDescription: cells[11]?.textContent?.trim() || '',
      postalCode: cells[12]?.textContent?.trim() || '',
      ePrescription: cells[13]?.textContent?.trim() === '1',
      onlineAppointment: cells[14]?.textContent?.trim() === '1',
      languages: (cells[15]?.textContent?.trim() || '').split(',').filter(Boolean),
    });
  }

  renderResults(block, locationName, provinceCode, providers);
}
