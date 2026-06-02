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

function renderHeader(c, provinciaDisplayName) {
  const centerName = formatName(c.name);
  const intro = `Consulta la información de ${centerName} dentro del cuadro médico de ASISA. Encuentra especialidades, servicios médicos y profesionales disponibles en este centro sanitario, así como datos de contacto y ubicación.`;
  return `<section class="eds-mp-box-head">
        <h1 class="eds-mp-box-head--title">${centerName} en ${provinciaDisplayName}</h1>
        <p class="eds-mp-box-head--text">${intro}</p>
      </section>`;
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

  return `
  <article class="eds-mp-user">
      <section class="eds-mp-user__content">
         <div class="eds-mp-card eds-mp-card--type-b eds-mp-card--blue">
           <div class="eds-mp-card__block">
             <div class="eds-mp-card__principal-tag">
                ${renderTagRow(c)}
                 <a class="eds-mp-card__principal-tag--share" href="${shareUrl}" target="_blank" rel="noopener">
                    Compartir
                    <i class="icon-share-021"></i>
                  </a>
             </div>
            <p class="eds-mp-card__type--name">${formatName(c.name)}</p>
           </div>
            <div class="eds-mp-card__block">
                ${addressLine ? `<div class="eds-mp-card__type--address"><i class="icon-marker-02"></i>${formatName(addressLine)}</div>` : ''}
                <div class="eds-mp-card__type--location">
                  ${mapsUrl ? `<div class="cmp-medical-detail__address-block__location--reach"><div class="button-cmp"><a href="${mapsUrl}" target="_blank" rel="noopener" class="button-cmp__text button-cmp__text--link button-location"><i class="icon-map-04 icon-large"></i>Cómo llegar</a></div></div>` : ''}
                </div>
                <div class="eds-mp-card__info--tags">${renderServiceTags(c)}</div>
            </div>
             <div class="eds-mp-card__info--buttons">
               ${c.phone ? `<div class="cmp-medical-detail__buttons-block">
                  <div class="button-cmp"><a href="tel:${c.phone}" class="button-cmp__text button-cmp__text--tertiary"><i class="icon-phone"></i>${c.phone}</a></div>
                </div>` : ''}
             </div>
         </div>
      </section>`;
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
  const phoneBlock = spec.phone ? `<div class="button-cmp"><a href="tel:${spec.phone}" class="button-cmp__text button-cmp__text--tertiary"><i class="icon-phone"></i>${spec.phone}</a></div>` : '';
  const citaBlock = showsPedirCita(spec)
    ? `<div class="button-cmp"><a href="${citaUrl}" target="_blank" rel="noopener" class="button-cmp__text button-cmp__text--primary">${ctaLabel}</a></div>`
    : '';

  return `
    <div class="eds-mp-spec-center">
        <div class="eds-mp-spec-center__header">
            <h3 class="eds-mp-spec-center__header--title">${formatName(spec.speciality)}</h3>
            <div class="eds-mp-spec-center__header--actions">
            ${phoneBlock}
            ${citaBlock}
            </div>
        </div>
        <details class="eds-mp-spec-center__details">
           <summary class="eds-mp-spec-center__details--toggle">Ver más información</summary>
           <div class="eds-mp-spec-center__details--container">
              <div class="eds-mp-spec-center__details--block">
                <h4 class="eds-mp-spec-center__details--block-title"><i class="icon-equipo-medico"></i>Cuadro de especialistas</h4>
                  ${docs.length ? `<ul class="eds-mp-spec-center__details--block-list">
                  ${docs.map((d) => `<li class="eds-mp-spec-center__details--block-item"><a href="/cuadro-medico/d/${d.key}">${formatName(d.name)}</a></li>`).join('')}
                </ul>` : '<p>—</p>'}
              </div>
              <div class="eds-mp-spec-center__details--block">
                  <h4 class="eds-mp-spec-center__details--block-title"><i class="icon-hospital"></i>Subespecialidades</h4>
                  ${subs.length ? `<ul class="cm-fcentro__spec-list">
                    ${subs.map((s) => `<li>${formatName(s)}</li>`).join('')}
                  </ul>` : '<p>—</p>'}
              </div>
              <div class="eds-mp-spec-center__details--block">
                <h4 class="eds-mp-spec-center__details--block-title"><i class="icon-advertencia"></i>Observaciones</h4>
                ${spec.observations ? `<p>${spec.observations}</p>` : '<p>—</p>'}
              
              </div>
           </div>
        </details>
     </div>`;
}

function renderSpecialitiesSection(c, provinciaDisplayName) {
  if (!c.specialities?.length) return '';
  return `
   <h2 class="eds-mp-user__subtitle">Especialidades médicas del centro</h2>
   <section class="eds-mp-user__content">
    ${c.specialities.map((s) => renderSpecAccordionItem(s, c, provinciaDisplayName)).join('')}
  </section></article>`;
}

function doctorIconClass(d) {
  if (d.gender === 'H') return 'icon-personal-asisa-mujer';
  if (d.gender === 'V') return 'icon-personal-asisa-hombre';
  // Fallback by name: "Dra." prefix → female
  return /^Dra\./.test(formatPersonName(d.name)) ? 'icon-personal-asisa-mujer' : 'icon-personal-asisa-hombre';
}

function renderDoctorCard(d) {
  return `<li class="eds-mp-spec-item">
    <i class="${doctorIconClass(d)}" aria-hidden="true"></i>
    <p class="eds-mp-spec-item--name">${formatPersonName(d.name)}</p>
    ${d.speciality ? `<p class="eds-mp-spec-item--spec">${formatName(d.speciality)}</p>` : ''}
    <p><a class="cm-fcentro__doctor-link" href="/cuadro-medico/d/${d.key}">Ver perfil</a></p>
  </li>`;
}

function renderDoctorsSection(c) {
  if (!c.doctors?.length) return '';
  return `<section class="eds-mp-spec">
    <h2 class="eds-mp-spec-title">Médicos en ${formatName(c.name)}</h2>
    <ul class="eds-mp-spec-list">
      ${c.doctors.map(renderDoctorCard).join('')}
    </ul>
  </section>`;
}

function renderOtherCentroCard(oc, provinciaDisplayName) {
  const addressLine = [oc.address, oc.postalCode, oc.city].filter(Boolean).join('. ');
  const tagLabel = oc.providerType === 4 ? 'LABORATORIO' : 'CENTRO MÉDICO';
  const specTags = (oc.specialities || []).map((s) => `<div class="cmp-tag-template cmp-tag-template--blank"><div class="cmp-tag-template__text">${formatName(s)}</div></div>`).join('');
  const moreTag = oc.specialitiesMore > 0 ? `<div class="cmp-tag-template cmp-tag-template--blank"><div class="cmp-tag-template__text">+ ${oc.specialitiesMore}más</div></div>` : '';
  const shareUrl = buildShareUrl(oc, provinciaDisplayName);

  return `
     <div class="eds-mp-card eds-mp-card--type-c eds-mp-card--white">
     <div class="eds-mp-card__block">
         <div class="eds-mp-card__principal-tag">
          <div class="cmp-tag-template cmp-tag-template--blue">
            <p class="cmp-tag-template__text">${tagLabel}</p>
          </div>
          ${oc.businessGroup ? '<div class="cmp-tag-template cmp-tag-template--blank"><p class="cmp-tag-template__text">Centro de ASISA</p></div>' : ''}
           <a class="eds-mp-card__principal-tag--share" href="${shareUrl}" target="_blank" rel="noopener">
                Compartir <i class="icon-share-021"></i>
           </a>
        </div>
        <p class="eds-mp-card__type--name"><a href="/cuadro-medico/c/${oc.key}">${formatName(oc.name)}</a></p>
         ${addressLine ? `<div class="eds-mp-card__type--address"><i class="icon-marker-02"></i>${formatName(addressLine)}</div>` : ''}
          <div class="eds-mp-card__info--tags">${specTags}${moreTag}</div>
     </div>
     <div class="eds-mp-card__info--buttons">
          ${oc.phone ? `<div class="eds-mp-card__info--buttons-detail"><div class="button-cmp"><a href="tel:${oc.phone}" class="button-cmp__text button-cmp__text--tertiary"><i class="icon-phone"></i>${oc.phone}</a></div></div>` : ''}
      <div class="eds-mp-card__info--buttons-detail"><div class="button-cmp"><a href="/cuadro-medico/c/${oc.key}" class="button-cmp__text button-cmp__text--primary">Ver detalle</a></div></div>
     </div>
     </div>`;
}

function renderOtherCentrosSection(c, provinciaDisplayName) {
  if (!c.otherCentros?.length) return '';
  return `<article class="eds-mp-doctor-center">
    <h2 class="eds-mp-doctor-center__title">Otros centros ASISA con las mismas especialidades en ${provinciaDisplayName}</h2>
    <section class="eds-mp-doctor-center__container">
      ${c.otherCentros.map((oc) => renderOtherCentroCard(oc, provinciaDisplayName)).join('')}
    </section>
  </article>`;
}

/**
 * Elimina los siblings que el overlay emitió por SEO. Los siblings llevan el
 * mismo texto que renderizamos ahora estilado dentro del bloque, así que sin
 * limpieza se mostraría duplicado.
 */
function removeSsrSiblings() {
  // Solo removemos el div del sibling — NUNCA su .section padre, que
  // puede contener también el bloque principal (todos los siblings van
  // en la misma section, así que borrar la section los llevaría a todos
  // incluyendo el bloque que acabamos de re-renderizar).
  ['cuadro-medico-ficha-centro-specs',
    'cuadro-medico-ficha-centro-doctors',
    'cuadro-medico-ficha-centro-others']
    .forEach((cls) => {
      document.querySelectorAll(`.${cls}`).forEach((el) => el.remove());
    });
}

export default function decorate(block) {
  const key = getKeyFromUrl();
  if (!key) { block.hidden = true; return; }

  // El overlay (api/markup.js · ssrCentro) pinta SSR para que Googlebot lo
  // indexe — pero EDS hace auto-blocking y descarta las clases CSS internas,
  // así que ese SSR sin clases no respeta el design system de ASISA. Aquí
  // renderizamos siempre la versión COMPLETA estilada y quitamos los siblings
  // de SEO. Como block ya tiene contenido SSR, NO mostramos "Cargando..."
  // para no parpadear; reemplazamos en silencio cuando llega la respuesta.
  const silent = block.children.length > 0;
  if (!silent) block.innerHTML = '<p>Cargando centro…</p>';

  Promise.all([
    fetch(`${API_BASE}/api/centro?key=${key}`).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
    fetch(`${API_BASE}/api/provincias`).then((r) => r.json()),
  ])
    .then(([c, provincias]) => {
      const provincia = provincias.find((p) => p.slug === c.provinceSlug);
      const provinciaDisplayName = provincia?.displayName || c.provinceSlug;

      block.innerHTML = `<div class="cmp-medical-detail">
        ${renderBreadcrumb(c, provinciaDisplayName)}
        ${renderHeader(c, provinciaDisplayName)}
        ${renderMainCard(c, provinciaDisplayName)}
        ${renderSpecialitiesSection(c, provinciaDisplayName)}
        ${renderDoctorsSection(c)}
        ${renderOtherCentrosSection(c, provinciaDisplayName)}
      </div>`;
      removeSsrSiblings();
    })
    .catch(() => {
      if (!silent) block.innerHTML = '<p>No se pudo cargar la ficha del centro.</p>';
    });
}
