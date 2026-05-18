/**
 * Bloque "cuadro-medico-spec-localizacion"
 *
 * Grid de provincias donde está disponible la especialidad del médico actual.
 * Lee la URL: /cuadro-medico/d/{key}
 */

function getKeyFromUrl() {
  const parts = window.location.pathname.split('/');
  const dIdx = parts.indexOf('d');
  return dIdx !== -1 ? parts[dIdx + 1] : null;
}

export default function decorate(block) {
  const key = getKeyFromUrl();
  if (!key) { block.hidden = true; return; }

  block.innerHTML = '<p class="cm-spec-loc-loading">Cargando…</p>';

  fetch(`https://asisa-pc.vercel.app/api/doctor?key=${key}`)
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(({ specSlug }) => fetch(`https://asisa-pc.vercel.app/api/especialidades?slug=${specSlug}`)
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }))
    .then((data) => {
      const { slug, name, provincias = [] } = data;

      block.innerHTML = `
        <h2 class="cm-spec-loc-title">${name} por localización</h2>
        <ul class="cm-spec-loc-list">
          ${provincias.map((p) => `
            <li class="cm-spec-loc-item">
              <a class="cm-spec-loc-card" href="/cuadro-medico/p/${p.slug}/pe/${slug}">
                <span class="cm-spec-loc-card__title">${name} en ${p.displayName}</span>
                <span class="cm-spec-loc-card__count">${p.count} profesionales</span>
              </a>
            </li>`).join('')}
        </ul>`;
    })
    .catch(() => { block.innerHTML = ''; });
}
