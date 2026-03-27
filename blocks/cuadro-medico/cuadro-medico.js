/**
 * Bloque EDS "cuadro-medico".
 *
 * Renderiza tarjetas de proveedores agrupadas por especialidad.
 *
 * Estructura esperada (filas generadas por /api/cuadro-medico):
 *  Fila 0: [locationName, provinceCode, totalProviders]
 *  Filas 1-N: [name, speciality, address, city, phone, lat, lon,
 *              doctorType, providerType, businessGroup, collegiateCode,
 *              parentDescription, postalCode, ePrescription, onlineAppt, languages]
 */

function getProviderType(p) {
  if (p.doctorType === '1') return { label: 'MÉDICO / PROFESIONAL', cls: 'type-doctor' };
  if (p.providerType === '3') return { label: 'HOSPITAL', cls: 'type-hospital' };
  if (p.providerType === '4') return { label: 'CENTRO MÉDICO', cls: 'type-centro' };
  if (p.providerType === '8') return { label: 'LABORATORIO', cls: 'type-lab' };
  if (p.providerType === '2') return { label: 'TRANSPORTE SANITARIO', cls: 'type-transport' };
  if (p.providerType === '9') return { label: 'OXIGENOTERAPIA', cls: 'type-oxygen' };
  return { label: 'PROVEEDOR', cls: 'type-default' };
}

function renderCard(p) {
  const type = getProviderType(p);
  const fullAddress = [p.address, p.postalCode, p.city].filter(Boolean).join(', ');
  const mapsUrl = (p.lat && p.lon)
    ? `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`
    : '';
  const langTags = p.languages.map((l) => `<span class="cm-tag tag-lang">${l}</span>`).join('');

  return `<div class="cm-card">
    <div class="cm-card-top">
      <div class="cm-card-badges">
        <span class="cm-card-type ${type.cls}">${type.label}</span>
        ${p.businessGroup ? '<span class="cm-card-asisa">Centro de ASISA</span>' : ''}
      </div>
      <div class="cm-card-tags">
        ${p.ePrescription ? '<span class="cm-tag tag-prescription">Receta electrónica</span>' : ''}
        ${langTags}
        ${p.onlineAppointment ? '<span class="cm-tag tag-online">Cita online</span>' : ''}
      </div>
    </div>
    <p class="cm-card-spec">${p.speciality}</p>
    <h3 class="cm-card-name">${p.name}</h3>
    ${p.collegiateCode ? `<p class="cm-card-collegiate"><em>Núm. Colegiado – ${p.collegiateCode}</em></p>` : ''}
    ${p.parentDescription ? `<p class="cm-card-parent">${p.parentDescription}</p>` : ''}
    <div class="cm-card-info">
      ${fullAddress ? `<p class="cm-card-address"><span class="icon-pin"></span>${fullAddress}</p>` : ''}
      <div class="cm-card-contact">
        ${mapsUrl ? `<a href="${mapsUrl}" target="_blank" rel="noopener" class="cm-link link-directions"><span class="icon-map"></span>Cómo llegar</a>` : ''}
        ${p.phone ? `<a href="tel:${p.phone}" class="cm-link link-phone"><span class="icon-phone"></span>${p.phone}</a>` : ''}
      </div>
    </div>
    <div class="cm-card-actions">
      <button class="cm-btn btn-detail">Ver Detalle</button>
      ${p.onlineAppointment ? '<button class="cm-btn btn-appointment">Pedir Cita</button>' : ''}
    </div>
  </div>`;
}

export default function decorate(block) {
  const rows = [...block.children];
  if (rows.length < 2) return;

  const locationName = rows[0]?.children[0]?.textContent?.trim() || '';

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

  // Group providers by speciality
  const groups = new Map();
  providers.forEach((p) => {
    const spec = p.speciality || 'Otros';
    if (!groups.has(spec)) groups.set(spec, []);
    groups.get(spec).push(p);
  });

  let html = `<p class="cm-count">${providers.length} resultados en ${locationName}</p>`;

  groups.forEach((specProviders, specName) => {
    html += `<h2 class="cm-spec-header">${specName}</h2>`;
    html += `<div class="cm-grid">${specProviders.map(renderCard).join('')}</div>`;
  });

  block.innerHTML = html;
}
