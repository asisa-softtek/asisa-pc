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
  const eIdx = parts.indexOf('e');
  let specSlug = peIdx !== -1 ? parts[peIdx + 1] : null;
  if (!specSlug && eIdx !== -1) specSlug = parts[eIdx + 1];
  return {
    provSlug: pIdx !== -1 ? parts[pIdx + 1] : null,
    specSlug,
  };
}

export default function decorate(block) {
  const { provSlug, specSlug } = getSlugsFromUrl();
  if (!specSlug) { block.hidden = true; return; }

  block.innerHTML = '<p class="cm-otras-prov-loading">Cargando provincias…</p>';

  fetch(`https://asisa-pc.vercel.app/api/especialidades?slug=${specSlug}`)
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((data) => {
      const provincias = (data.provincias || []).filter((p) => p.slug !== provSlug);
      if (!provincias.length) { block.hidden = true; return; }
      const specLower = (data.name || specSlug).toLowerCase();

      block.innerHTML = `
        <h2 class="cm-otras-prov-title">Otras provincias con ${specLower} ASISA</h2>
        <div class="cm-otras-prov-list">
          ${provincias.map((p) => `
            <article class="cm-otras-prov-card">
              <h3 class="cm-otras-prov-card__name">${data.name} ${p.displayName}</h3>
              <p class="cm-otras-prov-card__count">${p.count} profesionales</p>
              <a class="cm-otras-prov-card__arrow" href="/cuadro-medico/p/${p.slug}/pe/${specSlug}" aria-label="Ver ${data.name} en ${p.displayName}">→</a>
            </article>`).join('')}
        </div>`;
    })
    .catch(() => { block.innerHTML = ''; });
}
