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
  if (p.doctorType === '1') return { label: 'MÉDICO / PROFESIONAL', cls: 'cmp-tag-template--blue' };
  if (p.providerType === '3') return { label: 'HOSPITAL', cls: 'cmp-tag-template--blue' };
  if (p.providerType === '4') return { label: 'CENTRO MÉDICO', cls: 'cmp-tag-template--blue' };
  if (p.providerType === '8') return { label: 'LABORATORIO', cls: 'cmp-tag-template--blue' };
  if (p.providerType === '2') return { label: 'TRANSPORTE SANITARIO', cls: 'cmp-tag-template--blue' };
  if (p.providerType === '9') return { label: 'OXIGENOTERAPIA', cls: 'cmp-tag-template--blue' };
  return { label: 'PROVEEDOR', cls: 'type-cmp-tag-template--blue' };
}

function renderCard(p) {
  const type = getProviderType(p);
  const fullAddress = [p.address, p.postalCode, p.city].filter(Boolean).join(', ');
  const mapsUrl = (p.lat && p.lon)
    ? `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`
    : '';
  const langTags = p.languages.map((l) => `<span class="cm-tag tag-lang">${l}</span>`).join('');

  return `<div class="cmp-medical-detail__first-block">

    
    <div class="cmp-medical-detail__title-block">
      <div class="cmp-medical-detail__title-block__tags">
       <div class="cmp-medical-detail__title-block__tags--item ${type.cls}">
        <div class="cmp-tag-template__text">
            ${type.label}
        </div>
       </div>
       ${p.businessGroup ? '<div class="cmp-tag-template cmp-tag-template--blank"><div class="cmp-tag-template__text">Centro de ASISA</div></div>' : ''}
        
       <div class="cmp-medical-detail__title-block__tags--item">
          ${p.ePrescription ? '<div class="cmp-tag-template cmp-tag-template--blank"><div class="cmp-tag-template__text">Receta electrónica</div></div>' : ''}
          ${langTags}
          ${p.onlineAppointment ? '<div class="cmp-tag-template cmp-tag-template--blank"><div class="cmp-tag-template__text">Cita online</div></div>' : ''}
        </div>
      </div>
      <div class="cmp-title">
          <h3 class="cmp-title__text">${p.name}</h3>
      </div>
       ${p.collegiateCode ? `<p class="cmp-medical-detail__title-block--num-member"><em>Núm. Colegiado – ${p.collegiateCode}</em></p>` : ''}
        <p class="cmp-medical-picture-result__info-container__contact-data--speciality">${p.speciality}</p>
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
      ${p.onlineAppointment ? '<div class="button-cmp"><button class="btn button-cmp__text button-cmp__text--primary">Pedir Cita</button></div>' : ''}
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

  let html = `<div class="cmp-medical-picture-result__header"><div class="cmp-medical-picture-result__header--share-title-block"><div class="cmp-medical-picture-result__header--title">${providers.length} resultados en <strong>${locationName}</strong></div></div></div>`;

  groups.forEach((specProviders, specName) => {
    html += `<h2 class="cmp-medical-detail__subtitle">${specName}</h2>`;
    html += `<div class="cmp-medical-detail">${specProviders.map(renderCard).join('')}</div>`;
  });

  block.innerHTML = html;
}

