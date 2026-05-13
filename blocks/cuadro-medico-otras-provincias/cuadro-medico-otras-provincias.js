/**
 * Bloque "cuadro-medico-otras-provincias"
 *
 * Grid de cards con otras provincias que tienen la misma especialidad.
 * Sin parámetros AEM — lee la URL:
 *   /cuadro-medico/p/{provSlug}/pe/{specSlug}
 */

function getSlugsFromUrl() {
  const parts = window.location.pathname.split('/');
  const pIdx = parts.indexOf('p');
  const peIdx = parts.indexOf('pe');
  return {
    provSlug: pIdx !== -1 ? parts[pIdx + 1] : null,
    specSlug: peIdx !== -1 ? parts[peIdx + 1] : null,
  };
}

export default function decorate(block) {
  const { provSlug, specSlug } = getSlugsFromUrl();
  if (!specSlug) { block.hidden = true; return; }

  block.innerHTML = '<p class="cm-otras-prov-loading">Cargando provincias…</p>';

  fetch(`/api/especialidades?slug=${specSlug}`)
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((data) => {
      const provincias = (data.provincias || []).filter((p) => p.slug !== provSlug);

      block.innerHTML = `
        <h2 class="cm-otras-prov-title">Otras localidades con ${data.name.toLowerCase()} ASISA</h2>
        <ul class="cm-otras-prov-list">
          ${provincias.map((p) => `
            <li class="cm-otras-prov-item">
              <a class="cm-otras-prov-card" href="/cuadro-medico/p/${p.slug}/pe/${specSlug}">
                <div class="cm-otras-prov-card__info">
                  <span class="cm-otras-prov-card__name">${p.displayName}</span>
                  <span class="cm-otras-prov-card__count">${p.count} profesionales</span>
                </div>
                <span class="cm-otras-prov-card__arrow" aria-hidden="true">→</span>
              </a>
            </li>`).join('')}
        </ul>`;
    })
    .catch(() => { block.innerHTML = ''; });
}
