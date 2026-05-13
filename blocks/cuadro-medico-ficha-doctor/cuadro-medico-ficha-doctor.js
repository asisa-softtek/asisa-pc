/**
 * Bloque "cuadro-medico-ficha-doctor"
 *
 * Ficha completa del médico. Lee la URL:
 *   /cuadro-medico/d/{key}
 */

const ASISA_SEARCH = 'https://www.asisa.es/asegurado/salud/cuadro-medico/resultados-cuadro-medico';
const ASISA_SEARCH_PUBLIC = 'https://www.asisa.es/cuadro-medico/resultados-cuadro-medico';

function getKeyFromUrl() {
  const parts = window.location.pathname.split('/');
  const dIdx = parts.indexOf('d');
  return dIdx !== -1 ? parts[dIdx + 1] : null;
}

function formatName(raw) {
  if (!raw) return '';
  const [last = '', first = ''] = raw.split(',').map((s) => s.trim());
  const toTitle = (s) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return first ? `${toTitle(first)} ${toTitle(last)}` : toTitle(last);
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
    networkId: '1',
    networkName: 'Salud',
    ordination: 'Relevance',
    ordinationName: 'Relevancia',
    address: `${provinciaDisplayName || d.city || ''}, España`,
    provinceId: d.provinceCode || '',
    speciality: d.specialities[0] || '',
    specialityName: d.specialities[0] || '',
    specialityType: '1',
    fromPublicArea: 'true',
    concept: d.name,
  });
  if (d.lat && d.lon) {
    params.set('latitude', d.lat);
    params.set('longitude', d.lon);
  }
  return `${ASISA_SEARCH}?${params}`;
}

export default function decorate(block) {
  const key = getKeyFromUrl();
  if (!key) { block.hidden = true; return; }

  block.innerHTML = '<p class="cm-ficha-loading">Cargando médico…</p>';

  Promise.all([
    fetch(`/api/doctor?key=${key}`).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
    fetch('/api/provincias').then((r) => r.json()),
  ])
    .then(([d, provincias]) => {
      const provincia = provincias.find((p) => p.slug === d.provinceSlug);
      const provinciaDisplayName = provincia?.displayName || d.provinceSlug;

      const specs = d.specialities.map((s) => `<span class="cm-ficha-spec">${s}</span>`).join('');
      const collegiate = d.collegiateCode
        ? `<p class="cm-ficha-collegiate">Colegiado nº ${d.collegiateCode}</p>` : '';
      const addressLine = [d.address, d.postalCode, d.city].filter(Boolean).join(', ');
      const phone = d.phone
        ? `<a class="cm-ficha-phone" href="tel:${d.phone}">${d.phone}</a>` : '';
      const langs = d.languages?.length
        ? `<p class="cm-ficha-langs">Idiomas: ${d.languages.join(', ')}</p>` : '';

      const services = [
        d.onlineAppointment ? '<span class="cm-ficha-badge cm-ficha-badge--online">Cita online</span>' : '',
        d.videoConsultation ? '<span class="cm-ficha-badge cm-ficha-badge--video">Videoconsulta</span>' : '',
        d.ePrescription ? '<span class="cm-ficha-badge cm-ficha-badge--rx">Receta electrónica</span>' : '',
        d.tuotempo?.asisaLive ? '<span class="cm-ficha-badge cm-ficha-badge--live">ASISA Live</span>' : '',
      ].filter(Boolean).join('');

      const citaUrl = buildCitaUrl(d, provinciaDisplayName);
      const shareUrl = buildShareUrl(d, provinciaDisplayName);

      block.innerHTML = `
        <article class="cm-ficha">
          <header class="cm-ficha-header">
            <div class="cm-ficha-specs">${specs}</div>
            <h1 class="cm-ficha-name">${formatName(d.name)}</h1>
            ${collegiate}
          </header>
          <section class="cm-ficha-location">
            ${addressLine ? `<p class="cm-ficha-address">${addressLine}</p>` : ''}
            ${phone}
            ${services ? `<div class="cm-ficha-services">${services}</div>` : ''}
            ${langs}
          </section>
          <footer class="cm-ficha-actions">
            <a class="cm-ficha-cta" href="${citaUrl}" target="_blank" rel="noopener">Pedir cita</a>
            <a class="cm-ficha-share" href="${shareUrl}" target="_blank" rel="noopener">Compartir</a>
          </footer>
        </article>`;
    })
    .catch(() => {
      block.innerHTML = '<p class="cm-ficha-error">No se pudo cargar la ficha del médico.</p>';
    });
}
