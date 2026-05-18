/**
 * Bloque "cuadro-medico-otros-medicos"
 *
 * Chips de otros médicos con la misma especialidad en la misma provincia
 * y en el mismo centro. Lee la URL:
 *   /cuadro-medico/d/{key}
 */

function getKeyFromUrl() {
  const parts = window.location.pathname.split('/');
  const dIdx = parts.indexOf('d');
  return dIdx !== -1 ? parts[dIdx + 1] : null;
}

export default function decorate(block) {
  const key = getKeyFromUrl();
  if (!key) { block.hidden = true; return; }

  block.innerHTML = '<p class="cm-otros-med-loading">Cargando…</p>';

  fetch(`https://asisa-pc.vercel.app/api/doctor?key=${key}`)
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((doctor) => {
      const { specSlug, provinceSlug, city, specialities } = doctor;
      const specName = (specialities[0] || specSlug).toLowerCase();

      return fetch(`https://asisa-pc.vercel.app/api/providers?provinceSlug=${provinceSlug}&specSlug=${specSlug}&tab=professionals&limit=50`)
        .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(({ results = [] }) => {
          const currentUrl = `/cuadro-medico/d/${key}`;
          const others = results.filter((p) => p.detailUrl !== currentUrl);
          const sameCity = city ? others.filter((p) => p.city === city) : [];

          const makeChip = (p) => `
            <li class="cm-otros-med-item">
              <a class="cm-otros-med-chip" href="${p.detailUrl}">${p.name}</a>
            </li>`;

          let html = '';

          if (others.length) {
            html += `
              <section class="cm-otros-med-section">
                <h2 class="cm-otros-med-title">Otros médicos de ${specName} en ${provinceSlug}</h2>
                <ul class="cm-otros-med-list">${others.slice(0, 20).map(makeChip).join('')}</ul>
              </section>`;
          }

          if (sameCity.length) {
            html += `
              <section class="cm-otros-med-section">
                <h2 class="cm-otros-med-title">Otros médicos de ${specName} en ${city}</h2>
                <ul class="cm-otros-med-list">${sameCity.slice(0, 10).map(makeChip).join('')}</ul>
              </section>`;
          }

          block.innerHTML = html || '';
        });
    })
    .catch(() => { block.innerHTML = ''; });
}
